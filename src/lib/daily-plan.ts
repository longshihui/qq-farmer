import {
  DEFAULT_HARVEST_COUNT_PREFERENCE, GROWTH_HOURS, isHarvestCountPreference, isLandType, SEED_TYPES,
  type GrowthHours, type HarvestCountPreference, type LandType, type SeasonCount,
} from '../config'
import { calculateHarvest, parseBeijingDateTime, toBeijingInput } from './harvest'

const MINUTE_MS = 60_000

export interface AvailableWindow {
  start: string
  end: string
}

export interface CustomEventSeed {
  id: string
  growthHours: GrowthHours
  seasons: SeasonCount
  /** First-season planning weight; a second season receives half this value. */
  experienceWeight: number
}

export interface DailyPlanInput {
  date: string
  land: LandType
  /** How to choose among plans tied for the highest experience weight. */
  harvestCountPreference?: HarvestCountPreference
  seedIds: readonly string[]
  customEventSeeds?: readonly CustomEventSeed[]
  windows: readonly AvailableWindow[]
  /** Captured by the caller so planning remains deterministic, including on today's date. */
  now: number
}

export interface PlannedHarvest {
  season: SeasonCount
  readyAt: number
  harvestAt: number
  experienceWeight: number
}

export interface PlannedCrop {
  seedId: string
  seedLabel: string
  plantedAt: number
  harvests: PlannedHarvest[]
}

export interface DailyPlanResult {
  date: string
  land: LandType
  harvestCountPreference: HarvestCountPreference
  generatedAt: number
  planningFromAt: number
  totalExperienceWeight: number
  harvestCount: number
  crops: PlannedCrop[]
}

interface AbsoluteWindow {
  startAt: number
  endAt: number
}

interface Candidate {
  totalExperienceWeight: number
  harvestCount: number
  completedAt: number
  crops: PlannedCrop[]
}

type PlanningSeed = {
  id: string
  label: string
  growthHours: GrowthHours
} & (
  | { seasons: 1; experienceWeightBySeason: readonly [number] }
  | { seasons: 2; experienceWeightBySeason: readonly [number, number] }
)

function timeToMinutes(value: string): number | null {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value)
  return match ? Number(match[1]) * 60 + Number(match[2]) : null
}

function normalizeWindows(dayStart: number, windows: readonly AvailableWindow[]): AbsoluteWindow[] {
  const sorted = windows.map((window, index) => {
    const start = timeToMinutes(window.start)
    const end = timeToMinutes(window.end)
    if (start === null || end === null || start >= end) {
      throw new RangeError(`第 ${index + 1} 个可操作时段无效：起点须早于终点，且都在当天。`)
    }
    return { startAt: dayStart + start * MINUTE_MS, endAt: dayStart + end * MINUTE_MS }
  }).sort((a, b) => a.startAt - b.startAt)

  const merged: AbsoluteWindow[] = []
  for (const window of sorted) {
    const previous = merged.at(-1)
    if (previous && window.startAt <= previous.endAt + MINUTE_MS) {
      previous.endAt = Math.max(previous.endAt, window.endAt)
    } else {
      merged.push({ ...window })
    }
  }
  return merged
}

function isBetterForCount(candidate: Candidate, current: Candidate): boolean {
  return candidate.totalExperienceWeight > current.totalExperienceWeight
    || (candidate.totalExperienceWeight === current.totalExperienceWeight
      && candidate.completedAt < current.completedAt)
}

/** Find the exact best complete-crop schedule within one Beijing calendar day. */
export function optimizeDay(input: DailyPlanInput): DailyPlanResult {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) {
    throw new RangeError('计划日期无效。')
  }
  const dayStart = parseBeijingDateTime(`${input.date}T00:00`)
  if (dayStart === null) throw new RangeError('计划日期无效。')
  if (!isLandType(input.land)) throw new RangeError('土地类型无效。')
  if (input.harvestCountPreference !== undefined && !isHarvestCountPreference(input.harvestCountPreference)) {
    throw new RangeError('收菜次数偏好无效。')
  }
  if (!Number.isFinite(input.now)) throw new RangeError('计算时间无效。')
  const customEventSeeds = input.customEventSeeds ?? []
  const knownIds = new Set<string>(SEED_TYPES.map((seed) => seed.id))
  for (const seed of customEventSeeds) {
    if (!seed || typeof seed.id !== 'string' || seed.id.trim() === '' || knownIds.has(seed.id)) {
      throw new RangeError('活动种子编号无效或重复。')
    }
    if (!GROWTH_HOURS.includes(seed.growthHours) || (seed.seasons !== 1 && seed.seasons !== 2)
      || !Number.isFinite(seed.experienceWeight) || seed.experienceWeight <= 0) {
      throw new RangeError('活动种子配置无效。')
    }
    knownIds.add(seed.id)
  }
  if (input.seedIds.some((id) => !knownIds.has(id))) throw new RangeError('种子品类无效。')

  const windows = normalizeWindows(dayStart, input.windows)
  const harvestCountPreference = input.harvestCountPreference ?? DEFAULT_HARVEST_COUNT_PREFERENCE
  const isToday = input.date === toBeijingInput(input.now).slice(0, 10)
  const planningFromAt = isToday ? Math.ceil(input.now / MINUTE_MS) * MINUTE_MS : dayStart
  const selectedIds = new Set(input.seedIds)
  const customPlanningSeeds: PlanningSeed[] = customEventSeeds.map((seed) => {
    const label = `${seed.growthHours} 小时 · 活动 · ${seed.seasons === 1 ? '一季' : '两季'} · 经验权重 ${seed.experienceWeight}`
    return seed.seasons === 1
      ? { id: seed.id, label, growthHours: seed.growthHours, seasons: 1, experienceWeightBySeason: [seed.experienceWeight] }
      : { id: seed.id, label, growthHours: seed.growthHours, seasons: 2, experienceWeightBySeason: [seed.experienceWeight, seed.experienceWeight / 2] }
  })
  const selectedSeeds: PlanningSeed[] = [...SEED_TYPES, ...customPlanningSeeds]
    .filter((seed) => selectedIds.has(seed.id))
  const memo = new Map<number, Map<number, Candidate>>()

  function nextActionAt(time: number): number | null {
    const target = Math.ceil(Math.max(time, planningFromAt) / MINUTE_MS) * MINUTE_MS
    for (const window of windows) {
      const actionAt = Math.max(target, window.startAt)
      if (actionAt <= window.endAt) return actionAt
    }
    return null
  }

  function solve(freeAt: number): Map<number, Candidate> {
    const cached = memo.get(freeAt)
    if (cached) return cached

    const empty: Candidate = {
      totalExperienceWeight: 0,
      harvestCount: 0,
      completedAt: freeAt,
      crops: [],
    }
    const byHarvestCount = new Map<number, Candidate>([[0, empty]])
    // Earlier actions cannot reduce future choices: a mature crop may always wait
    // until a later window. This leaves only the seed choice to enumerate.
    const plantedAt = nextActionAt(freeAt)
    if (plantedAt === null) {
      memo.set(freeAt, byHarvestCount)
      return byHarvestCount
    }

    for (const seed of selectedSeeds) {
      const baseInput = {
        plantedAt,
        growthHours: seed.growthHours,
        seasons: seed.seasons,
        land: input.land,
      }
      const initialSchedule = calculateHarvest(baseInput)
      const firstHarvestAt = nextActionAt(initialSchedule.first.readyAt)
      if (firstHarvestAt === null) continue

      const harvests: PlannedHarvest[] = [{
        season: 1,
        readyAt: initialSchedule.first.readyAt,
        harvestAt: firstHarvestAt,
        experienceWeight: seed.experienceWeightBySeason[0],
      }]
      let lastHarvestAt = firstHarvestAt

      if (seed.seasons === 2) {
        const actualSchedule = calculateHarvest({ ...baseInput, actualFirstHarvestAt: firstHarvestAt })
        const secondHarvestAt = nextActionAt(actualSchedule.second!.readyAt)
        if (secondHarvestAt === null) continue
        harvests.push({
          season: 2,
          readyAt: actualSchedule.second!.readyAt,
          harvestAt: secondHarvestAt,
          experienceWeight: seed.experienceWeightBySeason[1],
        })
        lastHarvestAt = secondHarvestAt
      }

      const crop: PlannedCrop = {
        seedId: seed.id,
        seedLabel: seed.label,
        plantedAt,
        harvests,
      }
      const cropWeight = seed.experienceWeightBySeason.reduce((sum, weight) => sum + weight, 0)
      for (const tail of solve(lastHarvestAt).values()) {
        const candidate: Candidate = {
          totalExperienceWeight: cropWeight + tail.totalExperienceWeight,
          harvestCount: seed.seasons + tail.harvestCount,
          completedAt: tail.completedAt,
          crops: [crop, ...tail.crops],
        }
        const current = byHarvestCount.get(candidate.harvestCount)
        if (!current || isBetterForCount(candidate, current)) {
          byHarvestCount.set(candidate.harvestCount, candidate)
        }
      }
    }

    memo.set(freeAt, byHarvestCount)
    return byHarvestCount
  }

  const candidates = [...solve(planningFromAt).values()]
  const highestWeight = Math.max(...candidates.map((candidate) => candidate.totalExperienceWeight))
  const optimal = candidates.filter((candidate) => candidate.totalExperienceWeight === highestWeight)
  const counts = optimal.map((candidate) => candidate.harvestCount)
  const midpoint = (Math.min(...counts) + Math.max(...counts)) / 2
  function countRank(count: number): number {
    if (harvestCountPreference === 'fewer') return count
    if (harvestCountPreference === 'more') return -count
    return Math.abs(count - midpoint)
  }
  let best = optimal[0]
  for (const candidate of optimal.slice(1)) {
    const rank = countRank(candidate.harvestCount)
    const bestRank = countRank(best.harvestCount)
    if (rank < bestRank || (rank === bestRank && (
      candidate.completedAt < best.completedAt
      || (candidate.completedAt === best.completedAt && candidate.harvestCount < best.harvestCount)
    ))) best = candidate
  }
  return {
    date: input.date,
    land: input.land,
    harvestCountPreference,
    generatedAt: input.now,
    planningFromAt,
    totalExperienceWeight: best.totalExperienceWeight,
    harvestCount: best.harvestCount,
    crops: best.crops,
  }
}
