import { describe, expect, it } from 'vitest'
import {
  GROWTH_HOURS, HARVEST_COUNT_PREFERENCES, LAND, SEED_GROUPS, SEED_TYPES,
  type HarvestCountPreference,
} from '../config'
import { optimizeDay, type DailyPlanInput } from './daily-plan'
import { calculateHarvest, parseBeijingDateTime, toBeijingInput } from './harvest'

const previousDay = parseBeijingDateTime('2026-09-29T12:00')!

function plan(overrides: Partial<DailyPlanInput> = {}) {
  return optimizeDay({
    date: '2026-09-30',
    land: 'normal',
    seedIds: ['two-4'],
    windows: [{ start: '08:00', end: '20:00' }],
    now: previousDay,
    ...overrides,
  })
}

describe('shared farm rules', () => {
  it('offers regular and event seeds with their configured weights', () => {
    expect(GROWTH_HOURS).toEqual([4, 8, 12, 24])
    expect(SEED_TYPES).toHaveLength(9)
    expect(SEED_GROUPS.map((group) => group.id)).toEqual(['one-season', 'two-season', 'event-one', 'event-two'])
    expect(SEED_GROUPS.filter((group) => group.customSeason !== null).map((group) => group.customSeason))
      .toEqual([1, 2])
    expect(SEED_TYPES.find((seed) => seed.id === 'one-24')?.experienceWeightBySeason).toEqual([24])
    expect(SEED_TYPES.find((seed) => seed.id === 'two-24')?.experienceWeightBySeason).toEqual([24, 12])
    expect(SEED_TYPES.find((seed) => seed.id === 'event-12')).toMatchObject({
      group: 'event-one', growthHours: 12, seasons: 1, experienceWeightBySeason: [24],
    })
  })

  it('offers three harvest-count preferences and defaults to more harvests', () => {
    expect(HARVEST_COUNT_PREFERENCES.map((preference) => preference.value)).toEqual(['fewer', 'middle', 'more'])
    expect(plan().harvestCountPreference).toBe('more')
  })

  it('uses the same land speed rule in the existing calculator and the planner', () => {
    const plantedAt = parseBeijingDateTime('2026-09-30T08:00')!
    expect(LAND.gold.tenths).toBe(8)
    expect(calculateHarvest({ plantedAt, growthHours: 4, seasons: 1, land: 'gold' }).first.readyAt)
      .toBe(parseBeijingDateTime('2026-09-30T11:12'))
    const result = plan({ land: 'gold', seedIds: ['one-4'], windows: [{ start: '08:00', end: '12:00' }] })
    expect(toBeijingInput(result.crops[0].harvests[0].readyAt)).toBe('2026-09-30T11:12')
  })
})

describe('optimizeDay', () => {
  it('replants immediately and resolves equal experience by harvest count', () => {
    const result = plan({ seedIds: ['one-12', 'one-4', 'two-4'] })
    expect(result.totalExperienceWeight).toBe(12)
    expect(result.harvestCount).toBe(4)
    expect(result.crops.map((crop) => crop.seedId)).toEqual(['two-4', 'two-4'])
    expect(result.crops.flatMap((crop) => crop.harvests.map((harvest) => toBeijingInput(harvest.harvestAt))))
      .toEqual(['2026-09-30T12:00', '2026-09-30T14:00', '2026-09-30T18:00', '2026-09-30T20:00'])
  })

  it('prioritizes experience over harvest count', () => {
    const result = plan({
      seedIds: ['one-12', 'two-4'],
      windows: [
        { start: '08:00', end: '10:00' },
        { start: '14:00', end: '16:00' },
        { start: '22:00', end: '23:59' },
      ],
    })
    expect(result.crops.map((crop) => crop.seedId)).toEqual(['one-12'])
    expect(result.totalExperienceWeight).toBe(12)
    expect(result.harvestCount).toBe(1)
    expect(toBeijingInput(result.crops[0].harvests[0].harvestAt)).toBe('2026-09-30T22:00')
  })

  it('keeps experience weight first for every harvest-count preference', () => {
    for (const preference of HARVEST_COUNT_PREFERENCES) {
      const result = plan({
        harvestCountPreference: preference.value,
        seedIds: ['one-12', 'two-4'],
        windows: [
          { start: '08:00', end: '10:00' },
          { start: '14:00', end: '16:00' },
          { start: '22:00', end: '23:59' },
        ],
      })
      expect(result.crops.map((crop) => crop.seedId)).toEqual(['one-12'])
      expect(result.totalExperienceWeight).toBe(12)
      expect(result.harvestCount).toBe(1)
    }
  })

  it('selects fewer, middle, or more harvests among highest-weight plans', () => {
    const shared = { seedIds: ['one-12', 'one-8', 'one-4', 'two-4'] as const }
    const fewer = plan({ ...shared, harvestCountPreference: 'fewer' })
    const middle = plan({ ...shared, harvestCountPreference: 'middle' })
    const more = plan({ ...shared, harvestCountPreference: 'more' })
    expect([fewer, middle, more].map((result) => result.totalExperienceWeight)).toEqual([12, 12, 12])
    expect([fewer, middle, more].map((result) => result.harvestCount)).toEqual([1, 2, 4])
    expect(fewer.crops.map((crop) => crop.seedId)).toEqual(['one-12'])
    expect(more.crops.map((crop) => crop.seedId)).toEqual(['two-4', 'two-4'])
  })

  it('uses the reachable midpoint for a full day', () => {
    const shared = {
      seedIds: SEED_TYPES.filter((seed) => !seed.group.startsWith('event-')).map((seed) => seed.id),
      windows: [{ start: '00:00', end: '23:59' }],
    }
    const results = (['fewer', 'middle', 'more'] as const)
      .map((harvestCountPreference) => plan({ ...shared, harvestCountPreference }))
    expect(results.map((result) => result.totalExperienceWeight)).toEqual([22, 22, 22])
    expect(results.map((result) => result.harvestCount)).toEqual([3, 5, 7])
  })

  it('selects the 12-hour event seed for its 24 weight', () => {
    const result = plan({ seedIds: ['event-12', 'one-12'] })
    expect(result.crops.map((crop) => crop.seedId)).toEqual(['event-12'])
    expect(result.totalExperienceWeight).toBe(24)
    expect(result.harvestCount).toBe(1)
    expect(result.crops[0].harvests).toHaveLength(1)
    expect(toBeijingInput(result.crops[0].harvests[0].harvestAt)).toBe('2026-09-30T20:00')
  })

  it('includes a custom one-season event seed in the experience optimum', () => {
    const result = plan({
      seedIds: ['one-4', 'custom-one'],
      customEventSeeds: [{ id: 'custom-one', growthHours: 4, seasons: 1, experienceWeight: 9 }],
      windows: [{ start: '08:00', end: '12:00' }],
    })
    expect(result.crops.map((crop) => crop.seedId)).toEqual(['custom-one'])
    expect(result.totalExperienceWeight).toBe(9)
    expect(result.crops[0].seedLabel).toContain('经验权重 9')
  })

  it('halves a custom two-season event seed’s second growth time and experience weight', () => {
    const result = plan({
      seedIds: ['custom-two'],
      customEventSeeds: [{ id: 'custom-two', growthHours: 4, seasons: 2, experienceWeight: 20 }],
      windows: [{ start: '08:00', end: '14:00' }],
    })
    expect(result.harvestCount).toBe(2)
    expect(result.totalExperienceWeight).toBe(30)
    expect(result.crops[0].harvests.map((harvest) => toBeijingInput(harvest.readyAt)))
      .toEqual(['2026-09-30T12:00', '2026-09-30T14:00'])
    expect(result.crops[0].harvests.map((harvest) => harvest.experienceWeight)).toEqual([20, 10])
  })

  it('rejects duplicate or invalid custom event seeds and unknown selections', () => {
    const customEventSeeds = [{ id: 'custom-one', growthHours: 4, seasons: 1, experienceWeight: 9 }] as const
    expect(() => plan({ customEventSeeds: [...customEventSeeds, ...customEventSeeds] }))
      .toThrow('活动种子编号无效或重复')
    expect(() => plan({ customEventSeeds: [{ ...customEventSeeds[0], experienceWeight: 0 }] }))
      .toThrow('活动种子配置无效')
    expect(() => plan({ seedIds: ['unknown'] })).toThrow('种子品类无效')
  })

  it('chooses the earlier finish when experience and harvest count tie', () => {
    const result = plan({
      seedIds: ['one-8', 'one-12'],
      windows: [
        { start: '00:00', end: '01:00' },
        { start: '09:00', end: '10:00' },
        { start: '14:00', end: '15:00' },
        { start: '21:00', end: '23:59' },
      ],
    })
    expect(result.totalExperienceWeight).toBe(20)
    expect(result.harvestCount).toBe(2)
    expect(result.crops.map((crop) => crop.seedId)).toEqual(['one-8', 'one-12'])
    expect(toBeijingInput(result.crops[1].harvests[0].harvestAt)).toBe('2026-09-30T21:00')
  })

  it('starts the second season from the delayed first harvest', () => {
    const result = plan({ windows: [
      { start: '08:00', end: '09:00' },
      { start: '13:00', end: '14:00' },
      { start: '16:00', end: '17:00' },
    ] })
    const [first, second] = result.crops[0].harvests
    expect(toBeijingInput(first.readyAt)).toBe('2026-09-30T12:00')
    expect(toBeijingInput(first.harvestAt)).toBe('2026-09-30T13:00')
    expect(toBeijingInput(second.readyAt)).toBe('2026-09-30T15:00')
    expect(toBeijingInput(second.harvestAt)).toBe('2026-09-30T16:00')
    expect(result.totalExperienceWeight).toBe(6)
  })

  it('does not count a two-season crop that cannot finish both harvests', () => {
    const result = plan({ windows: [
      { start: '08:00', end: '09:00' },
      { start: '12:00', end: '13:00' },
    ] })
    expect(result.crops).toEqual([])
    expect(result.totalExperienceWeight).toBe(0)
    expect(result.harvestCount).toBe(0)
  })

  it('starts from the next minute on the current Beijing date', () => {
    const result = plan({
      seedIds: ['one-4'],
      now: parseBeijingDateTime('2026-09-30T11:00:30')!,
    })
    expect(toBeijingInput(result.planningFromAt)).toBe('2026-09-30T11:01')
    expect(result.crops.map((crop) => toBeijingInput(crop.plantedAt)))
      .toEqual(['2026-09-30T11:01', '2026-09-30T15:01'])
    expect(result.totalExperienceWeight).toBe(8)
  })

  it('merges overlapping windows and allows actions at their endpoints', () => {
    const result = plan({
      seedIds: ['one-4'],
      windows: [
        { start: '18:00', end: '20:00' },
        { start: '11:00', end: '14:00' },
        { start: '08:00', end: '12:00' },
      ],
    })
    expect(result.crops.map((crop) => toBeijingInput(crop.plantedAt)))
      .toEqual(['2026-09-30T08:00', '2026-09-30T12:00'])
    expect(result.crops.map((crop) => toBeijingInput(crop.harvests[0].harvestAt)))
      .toEqual(['2026-09-30T12:00', '2026-09-30T18:00'])
  })

  it('returns an empty plan when no selected seed or usable time remains', () => {
    expect(plan({ seedIds: [] }).crops).toEqual([])
    expect(plan({ windows: [] }).crops).toEqual([])
    const late = plan({ now: parseBeijingDateTime('2026-09-30T21:00')! })
    expect(late.crops).toEqual([])
  })

  it('rejects invalid dates and intervals', () => {
    expect(() => plan({ date: '2026-02-30' })).toThrow('计划日期无效')
    expect(() => plan({ windows: [{ start: '23:00', end: '02:00' }] })).toThrow('第 1 个可操作时段无效')
    expect(() => plan({ windows: [{ start: '09:00', end: '09:00' }] })).toThrow('第 1 个可操作时段无效')
    expect(() => plan({ harvestCountPreference: 'unknown' as HarvestCountPreference })).toThrow('收菜次数偏好无效')
  })
})
