import { GROWTH_HOURS, isLandType, SEED_TYPES, type LandType, type SeasonCount } from '../config'
import { calculateHarvest, parseBeijingDateTime, toBeijingInput } from './harvest'
import type { CustomEventSeed } from './daily-plan'

const MINUTE_MS = 60_000

export interface TargetPlanInput {
  /** Beijing calendar date; every action must occur on this date. */
  date: string
  windowStartTime: string
  windowEndTime: string
  land: LandType
  /** One entry means one planting across all 24 plots. Entries may repeat. */
  seedIds: readonly string[]
  customEventSeeds?: readonly CustomEventSeed[]
  useFertilizer: boolean
  now: number
}

export interface TargetHarvest {
  season: SeasonCount
  harvestAt: number
  /** Growth time removed from one representative plot in this season. */
  fertilizerReductionSeconds: number
}

export interface TargetCrop {
  seedId: string
  seedLabel: string
  /** Zero-based position in the user's requested planting list. */
  requestIndex: number
  plantedAt: number
  harvests: TargetHarvest[]
}

export interface TargetPlanResult {
  date: string
  land: LandType
  windowStartAt: number
  windowEndAt: number
  planningFromAt: number
  generatedAt: number
  completedAt: number
  fertilizerSecondsPerPlot: number
  fertilizerSecondsFor24Plots: number
  crops: TargetCrop[]
}

interface TargetSeed {
  id: string
  label: string
  growthHours: (typeof GROWTH_HOURS)[number]
  seasons: SeasonCount
}

interface RequestedCrop {
  seed: TargetSeed
  requestIndex: number
  firstDurationSeconds: number
  secondDurationSeconds: number
  totalDurationSeconds: number
}

function timeToMinutes(value: string): number | null {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value)
  return match ? Number(match[1]) * 60 + Number(match[2]) : null
}

/** Schedule every requested planting in one Beijing-day operating window. */
export function optimizeTargetPlan(input: TargetPlanInput): TargetPlanResult {
  if (!Number.isFinite(input.now)) throw new RangeError('计算时间无效。')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) throw new RangeError('计划日期无效。')
  const dayStart = parseBeijingDateTime(`${input.date}T00:00`)
  if (dayStart === null) throw new RangeError('计划日期无效。')
  const today = toBeijingInput(input.now).slice(0, 10)
  if (input.date < today) throw new RangeError('不能选择过去的日期。')

  const startMinutes = timeToMinutes(input.windowStartTime)
  const endMinutes = timeToMinutes(input.windowEndTime)
  if (startMinutes === null || endMinutes === null || startMinutes >= endMinutes) {
    throw new RangeError('可操作时段须使用 HH:mm，且结束时刻晚于开始时刻。')
  }
  if (!isLandType(input.land)) throw new RangeError('土地类型无效。')
  if (typeof input.useFertilizer !== 'boolean') throw new RangeError('化肥设置无效。')
  if (!Array.isArray(input.seedIds) || input.seedIds.length === 0) {
    throw new RangeError('请至少加入一次种子。')
  }

  const catalog = new Map<string, TargetSeed>(SEED_TYPES.map((seed) => [seed.id, seed]))
  for (const seed of input.customEventSeeds ?? []) {
    if (!seed || typeof seed.id !== 'string' || !seed.id.trim() || catalog.has(seed.id)) {
      throw new RangeError('活动种子编号无效或重复。')
    }
    if (!GROWTH_HOURS.includes(seed.growthHours) || (seed.seasons !== 1 && seed.seasons !== 2)
      || !Number.isFinite(seed.experienceWeight) || seed.experienceWeight <= 0) {
      throw new RangeError('活动种子配置无效。')
    }
    catalog.set(seed.id, {
      id: seed.id,
      label: `${seed.growthHours} 小时 · 活动 · ${seed.seasons === 1 ? '一季' : '两季'}`,
      growthHours: seed.growthHours,
      seasons: seed.seasons,
    })
  }

  const windowStartAt = dayStart + startMinutes * MINUTE_MS
  const windowEndAt = dayStart + endMinutes * MINUTE_MS
  const planningFromAt = input.date === today
    ? Math.max(windowStartAt, Math.ceil(input.now / MINUTE_MS) * MINUTE_MS)
    : windowStartAt
  if (planningFromAt >= windowEndAt) throw new RangeError('今天的可操作时段已结束。')

  const requested: RequestedCrop[] = input.seedIds.map((id, requestIndex) => {
    const seed = catalog.get(id)
    if (!seed) throw new RangeError('种子品类无效。')
    const schedule = calculateHarvest({
      plantedAt: 0, growthHours: seed.growthHours, seasons: seed.seasons, land: input.land,
    })
    const firstDurationSeconds = schedule.first.durationSeconds
    const secondDurationSeconds = schedule.second?.durationSeconds ?? 0
    return {
      seed, requestIndex, firstDurationSeconds, secondDurationSeconds,
      totalDurationSeconds: firstDurationSeconds + secondDurationSeconds,
    }
  })
  requested.sort((a, b) => a.totalDurationSeconds - b.totalDurationSeconds
    || a.firstDurationSeconds - b.firstDurationSeconds || a.requestIndex - b.requestIndex)

  const totalGrowthSeconds = requested.reduce((sum, crop) => sum + crop.totalDurationSeconds, 0)
  const availableSeconds = (windowEndAt - planningFromAt) / 1000
  const fertilizerSecondsPerPlot = Math.max(0, totalGrowthSeconds - availableSeconds)
  if (fertilizerSecondsPerPlot > 0 && !input.useFertilizer) {
    throw new RangeError('所选种子无法在可操作时段内全部收菜；请延长时段或允许使用化肥。')
  }

  let remainingFertilizer = fertilizerSecondsPerPlot
  let cursor = planningFromAt
  const crops: TargetCrop[] = requested.map((crop) => {
    const plantedAt = cursor
    const firstReduction = Math.min(crop.firstDurationSeconds, remainingFertilizer)
    remainingFertilizer -= firstReduction
    cursor += (crop.firstDurationSeconds - firstReduction) * 1000
    const harvests: TargetHarvest[] = [{
      season: 1, harvestAt: cursor, fertilizerReductionSeconds: firstReduction,
    }]
    if (crop.seed.seasons === 2) {
      const secondReduction = Math.min(crop.secondDurationSeconds, remainingFertilizer)
      remainingFertilizer -= secondReduction
      cursor += (crop.secondDurationSeconds - secondReduction) * 1000
      harvests.push({ season: 2, harvestAt: cursor, fertilizerReductionSeconds: secondReduction })
    }
    return { seedId: crop.seed.id, seedLabel: crop.seed.label, requestIndex: crop.requestIndex, plantedAt, harvests }
  })

  return {
    date: input.date, land: input.land, windowStartAt, windowEndAt, planningFromAt,
    generatedAt: input.now, completedAt: cursor, fertilizerSecondsPerPlot,
    fertilizerSecondsFor24Plots: fertilizerSecondsPerPlot * 24, crops,
  }
}
