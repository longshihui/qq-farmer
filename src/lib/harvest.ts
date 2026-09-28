export const GROWTH_HOURS = [4, 8, 12, 24] as const

export type GrowthHours = (typeof GROWTH_HOURS)[number]
export type SeasonCount = 1 | 2
export type LandType = 'normal' | 'black' | 'gold'

export const LAND = {
  normal: { label: '普通土地', reduction: 0, tenths: 10 },
  black: { label: '黑土地', reduction: 10, tenths: 9 },
  gold: { label: '金土地', reduction: 20, tenths: 8 },
} as const satisfies Record<LandType, {
  label: string
  reduction: number
  tenths: number
}>

export interface HarvestInput {
  plantedAt: number
  growthHours: GrowthHours
  seasons: SeasonCount
  firstLand: LandType
  secondLand: LandType
  actualFirstHarvestAt?: number | null
}

export interface SeasonSchedule {
  season: SeasonCount
  startAt: number
  readyAt: number
  baseDurationSeconds: number
  durationSeconds: number
  land: LandType
  startSource: 'planting' | 'expected-first-harvest' | 'actual-first-harvest'
}

export interface HarvestSchedule {
  first: SeasonSchedule
  second?: SeasonSchedule
}

const BEIJING_OFFSET_MS = 8 * 60 * 60 * 1000
const pad2 = (value: number) => String(value).padStart(2, '0')

export function calculateHarvest(input: HarvestInput): HarvestSchedule {
  if (!Number.isFinite(input.plantedAt)) {
    throw new RangeError('播种时间无效')
  }

  const firstBaseSeconds = input.growthHours * 60 * 60
  const firstDurationSeconds = firstBaseSeconds * LAND[input.firstLand].tenths / 10
  const firstReadyAt = input.plantedAt + firstDurationSeconds * 1000
  const first: SeasonSchedule = {
    season: 1,
    startAt: input.plantedAt,
    readyAt: firstReadyAt,
    baseDurationSeconds: firstBaseSeconds,
    durationSeconds: firstDurationSeconds,
    land: input.firstLand,
    startSource: 'planting',
  }

  if (input.seasons === 1) return { first }

  const actualFirstHarvestAt = input.actualFirstHarvestAt
  if (actualFirstHarvestAt != null && (
    !Number.isFinite(actualFirstHarvestAt) || actualFirstHarvestAt < firstReadyAt
  )) {
    throw new RangeError('第一次实际收菜时间不能早于第一季成熟时间')
  }

  const secondBaseSeconds = firstBaseSeconds / 2
  const secondDurationSeconds = secondBaseSeconds * LAND[input.secondLand].tenths / 10
  const secondStartAt = actualFirstHarvestAt ?? firstReadyAt

  return {
    first,
    second: {
      season: 2,
      startAt: secondStartAt,
      readyAt: secondStartAt + secondDurationSeconds * 1000,
      baseDurationSeconds: secondBaseSeconds,
      durationSeconds: secondDurationSeconds,
      land: input.secondLand,
      startSource: actualFirstHarvestAt == null
        ? 'expected-first-harvest'
        : 'actual-first-harvest',
    },
  }
}

/** Interpret a datetime-local value as a Beijing wall clock, independent of device timezone. */
export function parseBeijingDateTime(value: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(value)
  if (!match) return null

  const [, yearText, monthText, dayText, hourText, minuteText, secondText] = match
  const year = Number(yearText)
  const month = Number(monthText)
  const day = Number(dayText)
  const hour = Number(hourText)
  const minute = Number(minuteText)
  const second = Number(secondText ?? 0)
  if (year < 100 || month < 1 || month > 12 || hour > 23 || minute > 59 || second > 59) {
    return null
  }

  const wallClock = Date.UTC(year, month - 1, day, hour, minute, second)
  const check = new Date(wallClock)
  if (check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) {
    return null
  }
  return wallClock - BEIJING_OFFSET_MS
}

export function toBeijingInput(timestamp: number): string {
  return new Date(timestamp + BEIJING_OFFSET_MS).toISOString().slice(0, 19)
}

export function formatBeijingMoment(timestamp: number): { date: string; time: string; full: string } {
  const date = new Date(timestamp + BEIJING_OFFSET_MS)
  const year = date.getUTCFullYear()
  const month = date.getUTCMonth() + 1
  const day = date.getUTCDate()
  const hours = pad2(date.getUTCHours())
  const minutes = pad2(date.getUTCMinutes())
  const seconds = pad2(date.getUTCSeconds())
  const weekday = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][date.getUTCDay()]
  const dateText = `${year}年${month}月${day}日 · ${weekday}`
  const time = `${hours}:${minutes}:${seconds}`
  return { date: dateText, time, full: `${dateText} ${time}` }
}

export function formatDuration(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor(totalSeconds % 3600 / 60)
  const seconds = totalSeconds % 60
  return [
    hours > 0 ? `${hours}小时` : '',
    minutes > 0 ? `${minutes}分钟` : '',
    seconds > 0 ? `${seconds}秒` : '',
  ].filter(Boolean).join('') || '0秒'
}

export function formatCountdown(readyAt: number, now: number): string {
  if (readyAt <= now) return '已经到点，可以收菜'
  let seconds = Math.ceil((readyAt - now) / 1000)
  const days = Math.floor(seconds / 86400)
  seconds %= 86400
  const hours = Math.floor(seconds / 3600)
  seconds %= 3600
  const minutes = Math.floor(seconds / 60)
  seconds %= 60
  return `还有 ${days ? `${days}天 ` : ''}${pad2(hours)}:${pad2(minutes)}:${pad2(seconds)}`
}
