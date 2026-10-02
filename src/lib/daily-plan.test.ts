import { describe, expect, it } from 'vitest'
import {
  GROWTH_HOURS, HARVEST_COUNT_PREFERENCES, LAND, SEED_GROUPS, SEED_TYPES,
  type HarvestCountPreference,
} from '../config'
import { optimizeDay, type DailyPlanInput } from './daily-plan'
import { calculateHarvest, parseBeijingDateTime, toBeijingInput } from './harvest'

const previousDay = parseBeijingDateTime('2026-09-29T12:00')!
const at = (value: string) => parseBeijingDateTime(value)!
const formatted = (times: number[]) => times.map(toBeijingInput)

function plan(overrides: Partial<DailyPlanInput> = {}) {
  return optimizeDay({
    date: '2026-09-30',
    cycleStartTime: '08:00',
    sleepWindows: [{ start: '00:00', end: '08:00' }],
    land: 'normal',
    seedIds: ['one-4'],
    now: previousDay,
    ...overrides,
  })
}

describe('shared farm rules', () => {
  it('keeps seed configuration and land speed shared with the single calculator', () => {
    expect(GROWTH_HOURS).toEqual([4, 8, 12, 24])
    expect(SEED_TYPES).toHaveLength(9)
    expect(SEED_GROUPS.map((group) => group.id)).toEqual(['one-season', 'two-season', 'event-one', 'event-two'])
    expect(LAND.gold.tenths).toBe(8)
    const plantedAt = at('2026-09-30T08:00')
    expect(calculateHarvest({ plantedAt, growthHours: 4, seasons: 1, land: 'gold' }).first.readyAt)
      .toBe(at('2026-09-30T11:12'))
    expect(plan({ land: 'gold' }).crops[0].harvests[0].readyAt).toBe(at('2026-09-30T11:12'))
  })

  it('offers the renamed count strategies and defaults to most harvests', () => {
    expect(HARVEST_COUNT_PREFERENCES.map((item) => item.label)).toEqual(['次数最少', '平衡', '次数最多'])
    expect(plan().harvestCountPreference).toBe('more')
  })
})

describe('optimizeDay cycle and sleep', () => {
  it('uses a 24-hour cycle and never plants at its endpoint', () => {
    const result = plan()
    expect(formatted([result.cycleStartAt, result.cycleEndAt]))
      .toEqual(['2026-09-30T08:00', '2026-10-01T08:00'])
    expect(formatted(result.crops.map((crop) => crop.plantedAt)))
      .toEqual(['2026-09-30T08:00', '2026-09-30T12:00', '2026-09-30T16:00', '2026-09-30T20:00'])
    expect(result.crops.at(-1)!.harvests[0].harvestAt).toBe(result.cycleEndAt)
  })

  it('allows only the final harvest to pass the endpoint', () => {
    const result = plan({ seedIds: ['one-4', 'one-24'] })
    expect(result.totalExperienceWeight).toBe(36)
    expect(result.crops.at(-1)!.seedId).toBe('one-24')
    expect(result.crops.at(-1)!.harvests[0].harvestAt).toBe(at('2026-10-01T20:00'))
    expect(result.crops.slice(0, -1).every((crop) =>
      crop.harvests.at(-1)!.harvestAt <= result.cycleEndAt)).toBe(true)
    expect(result.crops.every((crop) => crop.plantedAt < result.cycleEndAt)).toBe(true)
  })

  it('requires a two-season crop to finish its first harvest by the endpoint', () => {
    const result = plan({ seedIds: ['two-24'] })
    expect(result.crops).toHaveLength(1)
    expect(formatted(result.crops[0].harvests.map((harvest) => harvest.harvestAt)))
      .toEqual(['2026-10-01T08:00', '2026-10-01T20:00'])
    const late = plan({ seedIds: ['two-24'], cycleStartTime: '20:00', sleepWindows: [{ start: '22:00', end: '08:00' }] })
    expect(late.crops[0].harvests[0].harvestAt).toBe(late.cycleEndAt)
  })

  it('holds a crop ready for harvest to cover sleep and has no actions during sleep', () => {
    const result = plan({ sleepWindows: [{ start: '12:00', end: '16:00' }] })
    expect(result.crops[0].plantedAt).toBe(at('2026-09-30T08:00'))
    expect(result.crops[0].harvests[0].readyAt).toBe(at('2026-09-30T12:00'))
    expect(result.crops[0].harvests[0].harvestAt).toBe(at('2026-09-30T16:00'))
    const actions = result.crops.flatMap((crop) => [crop.plantedAt, ...crop.harvests.map((h) => h.harvestAt)])
    expect(actions.every((action) => action < at('2026-09-30T12:00') || action >= at('2026-09-30T16:00'))).toBe(true)
  })

  it('starts a two-season crop’s second season from its delayed first harvest', () => {
    const result = plan({ seedIds: ['two-4'], sleepWindows: [{ start: '12:00', end: '16:00' }] })
    const [first, second] = result.crops[0].harvests
    expect(formatted([first.readyAt, first.harvestAt, second.readyAt, second.harvestAt]))
      .toEqual(['2026-09-30T12:00', '2026-09-30T16:00', '2026-09-30T18:00', '2026-09-30T18:00'])
  })

  it('supports sleep across midnight and permits action at wake time', () => {
    const result = plan({ sleepWindows: [{ start: '22:00', end: '06:00' }] })
    const sleepStart = at('2026-09-30T22:00')
    const sleepEnd = at('2026-10-01T06:00')
    const spanningCrop = result.crops.find((crop) => crop.plantedAt <= sleepStart
      && crop.harvests.at(-1)!.harvestAt >= sleepEnd)
    expect(spanningCrop).toBeDefined()
    const actions = result.crops.flatMap((crop) => [crop.plantedAt, ...crop.harvests.map((h) => h.harvestAt)])
    expect(actions.some((action) => action === sleepEnd)).toBe(true)
    expect(actions.every((action) => action < sleepStart || action >= sleepEnd)).toBe(true)
  })

  it('covers both a daily nap and overnight sleep without actions in either', () => {
    const result = plan({ sleepWindows: [
      { start: '00:00', end: '08:00' },
      { start: '12:00', end: '13:00' },
    ] })
    const napStart = at('2026-09-30T12:00')
    const napEnd = at('2026-09-30T13:00')
    const nightStart = at('2026-10-01T00:00')
    const nightEnd = at('2026-10-01T08:00')
    const spans = (start: number, end: number) => result.crops.some((crop) =>
      crop.plantedAt <= start && crop.harvests.at(-1)!.harvestAt >= end)
    const actions = result.crops.flatMap((crop) => [crop.plantedAt, ...crop.harvests.map((h) => h.harvestAt)])
    expect(spans(napStart, napEnd)).toBe(true)
    expect(spans(nightStart, nightEnd)).toBe(true)
    expect(actions.every((action) => (action < napStart || action >= napEnd)
      && (action < nightStart || action >= nightEnd))).toBe(true)
    expect(result.crops[0].harvests[0].harvestAt).toBe(napEnd)
  })

  it('merges overlapping and touching naps into one continuous sleep', () => {
    const merged = plan({ sleepWindows: [{ start: '12:00', end: '14:00' }] })
    for (const windows of [
      [{ start: '12:30', end: '14:00' }, { start: '12:00', end: '13:00' }],
      [{ start: '12:00', end: '13:00' }, { start: '13:00', end: '14:00' }],
    ]) {
      const result = plan({ sleepWindows: windows })
      expect(result.crops).toEqual(merged.crops)
    }
  })

  it('merges sleep windows across midnight before choosing a wake time', () => {
    const result = plan({ sleepWindows: [
      { start: '05:00', end: '07:00' },
      { start: '22:00', end: '06:00' },
    ] })
    const sleepStart = at('2026-09-30T22:00')
    const sleepEnd = at('2026-10-01T07:00')
    expect(result.crops.some((crop) => crop.plantedAt <= sleepStart
      && crop.harvests.at(-1)!.harvestAt >= sleepEnd)).toBe(true)
    const actions = result.crops.flatMap((crop) => [crop.plantedAt, ...crop.harvests.map((h) => h.harvestAt)])
    expect(actions.some((action) => action === sleepEnd)).toBe(true)
    expect(actions.every((action) => action < sleepStart || action >= sleepEnd)).toBe(true)
  })

  it('returns no feasible crops when merged sleep covers every minute', () => {
    const result = plan({ sleepWindows: [
      { start: '00:00', end: '12:00' },
      { start: '12:00', end: '00:00' },
    ] })
    expect(result.crops).toEqual([])
    expect(result.totalExperienceWeight).toBe(0)
  })

  it('continues from the next minute today while keeping the original endpoint', () => {
    const result = plan({ now: at('2026-09-30T11:00:30') })
    expect(result.planningFromAt).toBe(at('2026-09-30T11:01'))
    expect(result.crops[0].plantedAt).toBe(result.planningFromAt)
    expect(result.cycleEndAt).toBe(at('2026-10-01T08:00'))
  })

  it('defers planting when the cycle starts during sleep and skips the partial sleep', () => {
    const result = plan({ cycleStartTime: '02:00' })
    expect(result.crops[0].plantedAt).toBe(at('2026-09-30T08:00'))
    expect(result.cycleEndAt).toBe(at('2026-10-01T02:00'))
    const nextSleepStart = at('2026-10-01T00:00')
    const nextSleepEnd = at('2026-10-01T08:00')
    expect(result.crops.some((crop) => crop.plantedAt <= nextSleepStart
      && crop.harvests.at(-1)!.harvestAt >= nextSleepEnd)).toBe(true)
  })

  it('skips an overlapping partial sleep at the cycle start', () => {
    const result = plan({ cycleStartTime: '02:00', sleepWindows: [
      { start: '00:00', end: '08:00' },
      { start: '07:00', end: '09:00' },
    ] })
    expect(result.crops[0].plantedAt).toBe(at('2026-09-30T09:00'))
  })

  it('skips an already-started sleep when continuing today', () => {
    const result = plan({ cycleStartTime: '00:00', now: at('2026-09-30T02:10') })
    expect(result.planningFromAt).toBe(at('2026-09-30T02:10'))
    expect(result.crops[0].plantedAt).toBe(at('2026-09-30T08:00'))
  })

  it('returns no crops when the selected cycle has already ended', () => {
    const result = plan({ now: at('2026-09-30T23:59:30'), cycleStartTime: '00:00' })
    expect(result.crops).toEqual([])
  })
})

describe('experience and harvest-count strategies', () => {
  it('chooses fewer, balanced, or more harvests among equal maximum weights', () => {
    const seedIds = ['one-4', 'one-8', 'one-12', 'one-24']
    const results = (['fewer', 'middle', 'more'] as const)
      .map((harvestCountPreference) => plan({ seedIds, harvestCountPreference }))
    expect(results.map((result) => result.totalExperienceWeight)).toEqual([36, 36, 36])
    expect(results.map((result) => result.harvestCount)).toEqual([2, 3, 4])
  })

  it('keeps experience weight above all count strategies', () => {
    const results = HARVEST_COUNT_PREFERENCES.map((item) => plan({
      seedIds: ['one-24', 'event-12'], harvestCountPreference: item.value,
    }))
    expect(results.map((result) => result.totalExperienceWeight)).toEqual([48, 48, 48])
    expect(results.every((result) => result.crops.every((crop) => crop.seedId === 'event-12'))).toBe(true)
  })

  it('includes custom event seeds and second-season half weight', () => {
    const result = plan({
      seedIds: ['custom-two'],
      customEventSeeds: [{ id: 'custom-two', growthHours: 4, seasons: 2, experienceWeight: 20 }],
    })
    expect(result.crops[0].harvests.map((harvest) => harvest.experienceWeight)).toEqual([20, 10])
    expect(result.crops[0].seedLabel).toContain('经验权重 20')
  })
})

describe('input validation', () => {
  it('rejects invalid dates, times, sleep lengths, and strategies', () => {
    expect(() => plan({ date: '2026-02-30' })).toThrow('计划日期无效')
    expect(() => plan({ cycleStartTime: '24:00' })).toThrow('日循环开始时刻无效')
    expect(() => plan({ sleepWindows: [{ start: '09:00', end: '09:00' }] })).toThrow('第 1 个睡眠时段无效')
    expect(() => plan({ sleepWindows: [{ start: '', end: '08:00' }] })).toThrow('第 1 个睡眠时段无效')
    expect(() => plan({ sleepWindows: [] })).toThrow('请至少添加一个睡眠时段')
    expect(() => plan({ sleepWindows: [{ start: '00:00', end: '08:00' }, { start: '12:00', end: '12:00' }] }))
      .toThrow('第 2 个睡眠时段无效')
    expect(() => plan({ harvestCountPreference: 'unknown' as HarvestCountPreference })).toThrow('收菜次数偏好无效')
  })

  it('rejects duplicate or invalid custom event seeds and unknown selections', () => {
    const customEventSeeds = [{ id: 'custom-one', growthHours: 4, seasons: 1, experienceWeight: 9 }] as const
    expect(() => plan({ customEventSeeds: [...customEventSeeds, ...customEventSeeds] }))
      .toThrow('活动种子编号无效或重复')
    expect(() => plan({ customEventSeeds: [{ ...customEventSeeds[0], experienceWeight: 0 }] }))
      .toThrow('活动种子配置无效')
    expect(() => plan({ seedIds: ['unknown'] })).toThrow('种子品类无效')
  })
})
