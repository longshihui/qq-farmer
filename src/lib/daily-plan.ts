import {
  DEFAULT_HARVEST_COUNT_PREFERENCE, GROWTH_HOURS, isHarvestCountPreference, isLandType, SEED_TYPES,
  type GrowthHours, type HarvestCountPreference, type LandType, type SeasonCount,
} from '../config'
import { calculateHarvest, parseBeijingDateTime, toBeijingInput } from './harvest'

const MINUTE_MS = 60_000
const DAY_MS = 24 * 60 * MINUTE_MS

export interface SleepWindow {
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
  /** Beijing date on which the cycle starts. */
  date: string
  cycleStartTime: string
  sleepWindows: readonly SleepWindow[]
  land: LandType
  /** How to choose among plans tied for the highest experience weight. */
  harvestCountPreference?: HarvestCountPreference
  seedIds: readonly string[]
  customEventSeeds?: readonly CustomEventSeed[]
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
  cycleStartAt: number
  cycleEndAt: number
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

function normalizeSleepWindows(dayStart: number, windows: readonly SleepWindow[]): AbsoluteWindow[] {
  if (!Array.isArray(windows) || windows.length === 0) {
    throw new RangeError('请至少添加一个睡眠时段。')
  }
  const daily = windows.map((window, index) => {
    const start = timeToMinutes(window?.start)
    const end = timeToMinutes(window?.end)
    if (start === null || end === null || start === end) {
      throw new RangeError(`第 ${index + 1} 个睡眠时段无效：起止时刻须不同，且格式为 HH:mm。`)
    }
    return { start, duration: (end - start + 1440) % 1440 }
  })
  const repeated: AbsoluteWindow[] = []
  // The final harvest may follow the cycle; include sleep around that tail.
  for (let day = -2; day <= 4; day++) {
    for (const window of daily) {
      const startAt = dayStart + day * DAY_MS + window.start * MINUTE_MS
      repeated.push({ startAt, endAt: startAt + window.duration * MINUTE_MS })
    }
  }
  repeated.sort((a, b) => a.startAt - b.startAt)
  const merged: AbsoluteWindow[] = []
  for (const window of repeated) {
    const previous = merged.at(-1)
    if (previous && window.startAt <= previous.endAt) {
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

/** Find the best complete-crop schedule for a 24-hour Beijing-time cycle. */
export function optimizeDay(input: DailyPlanInput): DailyPlanResult {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) {
    throw new RangeError('计划日期无效。')
  }
  const dayStart = parseBeijingDateTime(`${input.date}T00:00`)
  if (dayStart === null) throw new RangeError('计划日期无效。')
  const cycleStartMinutes = timeToMinutes(input.cycleStartTime)
  if (cycleStartMinutes === null) throw new RangeError('日循环开始时刻无效。')
  const sleepWindows = normalizeSleepWindows(dayStart, input.sleepWindows)
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

  const cycleStartAt = dayStart + cycleStartMinutes * MINUTE_MS
  const cycleEndAt = cycleStartAt + DAY_MS
  const harvestCountPreference = input.harvestCountPreference ?? DEFAULT_HARVEST_COUNT_PREFERENCE
  const isToday = input.date === toBeijingInput(input.now).slice(0, 10)
  const planningFromAt = isToday
    ? Math.max(cycleStartAt, Math.ceil(input.now / MINUTE_MS) * MINUTE_MS)
    : cycleStartAt
  // A sleep already in progress at planningFromAt is exempt from occupancy.
  const mandatorySleeps = sleepWindows.filter((sleep) =>
    sleep.startAt > planningFromAt && sleep.startAt < cycleEndAt)
  const alwaysAsleep = sleepWindows.some((sleep) => sleep.endAt - sleep.startAt >= DAY_MS)
  if (alwaysAsleep) {
    return {
      date: input.date, land: input.land, harvestCountPreference, generatedAt: input.now,
      cycleStartAt, cycleEndAt, planningFromAt, totalExperienceWeight: 0, harvestCount: 0, crops: [],
    }
  }
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

  function nextAwakeAt(time: number): number {
    let target = Math.ceil(time / MINUTE_MS) * MINUTE_MS
    for (const sleep of sleepWindows) {
      if (sleep.startAt <= target && target < sleep.endAt) target = sleep.endAt
    }
    return target
  }

  function harvestOptions(readyAt: number, plantedAt: number): number[] {
    const first = nextAwakeAt(readyAt)
    const options = new Set<number>([first])
    // A crop ready to harvest may need to stand through sleep when no replacement crop can.
    for (const sleep of mandatorySleeps) {
      if (plantedAt <= sleep.startAt && first < sleep.endAt) options.add(sleep.endAt)
    }
    return [...options].sort((a, b) => a - b)
  }

  function canStopAt(time: number): boolean {
    return mandatorySleeps.every((sleep) => sleep.startAt < time)
  }

  function solve(freeAt: number): Map<number, Candidate> {
    const cached = memo.get(freeAt)
    if (cached) return cached

    const byHarvestCount = new Map<number, Candidate>()
    if (canStopAt(freeAt)) {
      byHarvestCount.set(0, { totalExperienceWeight: 0, harvestCount: 0, completedAt: freeAt, crops: [] })
    }
    const plantedAt = nextAwakeAt(Math.max(freeAt, planningFromAt))
    if (plantedAt >= cycleEndAt) {
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
      const cropWeight = seed.experienceWeightBySeason.reduce((sum, weight) => sum + weight, 0)
      for (const firstHarvestAt of harvestOptions(initialSchedule.first.readyAt, plantedAt)) {
        if (seed.seasons === 2 && firstHarvestAt > cycleEndAt) continue
        const first: PlannedHarvest = {
          season: 1, readyAt: initialSchedule.first.readyAt, harvestAt: firstHarvestAt,
          experienceWeight: seed.experienceWeightBySeason[0],
        }
        const secondReadyAt = seed.seasons === 2
          ? calculateHarvest({ ...baseInput, actualFirstHarvestAt: firstHarvestAt }).second!.readyAt
          : null
        const finalHarvestTimes = secondReadyAt === null
          ? [firstHarvestAt] : harvestOptions(secondReadyAt, plantedAt)
        for (const lastHarvestAt of finalHarvestTimes) {
          const harvests: PlannedHarvest[] = [first]
          if (secondReadyAt !== null) {
            harvests.push({
              season: 2, readyAt: secondReadyAt, harvestAt: lastHarvestAt,
              experienceWeight: seed.experienceWeightBySeason[1]!,
            })
          }
          const crop: PlannedCrop = { seedId: seed.id, seedLabel: seed.label, plantedAt, harvests }
          for (const tail of solve(lastHarvestAt).values()) {
            const candidate: Candidate = {
              totalExperienceWeight: cropWeight + tail.totalExperienceWeight,
              harvestCount: seed.seasons + tail.harvestCount,
              completedAt: tail.completedAt,
              crops: [crop, ...tail.crops],
            }
            const current = byHarvestCount.get(candidate.harvestCount)
            if (!current || isBetterForCount(candidate, current)) byHarvestCount.set(candidate.harvestCount, candidate)
          }
        }
      }
    }

    memo.set(freeAt, byHarvestCount)
    return byHarvestCount
  }

  const candidates = [...solve(planningFromAt).values()]
  if (candidates.length === 0) {
    return {
      date: input.date, land: input.land, harvestCountPreference, generatedAt: input.now,
      cycleStartAt, cycleEndAt, planningFromAt, totalExperienceWeight: 0, harvestCount: 0, crops: [],
    }
  }
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
    cycleStartAt,
    cycleEndAt,
    planningFromAt,
    totalExperienceWeight: best.totalExperienceWeight,
    harvestCount: best.harvestCount,
    crops: best.crops,
  }
}
