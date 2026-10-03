import { describe, expect, it } from 'vitest'
import { optimizeTargetPlan, type TargetPlanInput } from './target-plan'
import { parseBeijingDateTime, toBeijingInput } from './harvest'

const at = (value: string) => parseBeijingDateTime(value)!
const priorDay = at('2026-10-02T12:00')

function plan(overrides: Partial<TargetPlanInput> = {}) {
  return optimizeTargetPlan({
    date: '2026-10-03', windowStartTime: '08:00', windowEndTime: '20:00',
    land: 'normal', seedIds: ['one-4'], useFertilizer: false, now: priorDay,
    ...overrides,
  })
}

describe('target planting schedule', () => {
  it('keeps repeated seed selections as separate plantings and sorts shorter crops first', () => {
    const result = plan({
      seedIds: ['one-8', 'one-4', 'one-4'], windowStartTime: '00:00', windowEndTime: '20:00',
    })
    expect(result.crops.map((crop) => [crop.seedId, crop.requestIndex])).toEqual([
      ['one-4', 1], ['one-4', 2], ['one-8', 0],
    ])
    expect(result.crops.map((crop) => toBeijingInput(crop.plantedAt))).toEqual([
      '2026-10-03T00:00', '2026-10-03T04:00', '2026-10-03T08:00',
    ])
  })

  it('waits for the first harvest before starting the second season or next planting', () => {
    const result = plan({ seedIds: ['two-4', 'one-8'], windowEndTime: '22:00' })
    expect(result.crops[0].harvests.map((harvest) => toBeijingInput(harvest.harvestAt)))
      .toEqual(['2026-10-03T12:00', '2026-10-03T14:00'])
    expect(result.crops[1].plantedAt).toBe(at('2026-10-03T14:00'))
  })

  it('uses the shared land speed rules for normal, black, and gold plots', () => {
    expect((['normal', 'black', 'gold'] as const).map((land) =>
      toBeijingInput(plan({ land }).completedAt)))
      .toEqual(['2026-10-03T12:00', '2026-10-03T11:36', '2026-10-03T11:12'])
  })

  it("starts future plans at the window start and today's plan at the next minute", () => {
    expect(plan({ now: at('2026-10-02T19:00') }).planningFromAt).toBe(at('2026-10-03T08:00'))
    expect(plan({ now: at('2026-10-03T10:15:20'), windowEndTime: '15:00' }).planningFromAt)
      .toBe(at('2026-10-03T10:16'))
    expect(plan({ now: at('2026-10-03T10:15:00'), windowEndTime: '15:00' }).planningFromAt)
      .toBe(at('2026-10-03T10:15'))
  })

  it('rejects an impossible no-fertilizer plan without returning a partial schedule', () => {
    expect(() => plan({ seedIds: ['one-8', 'one-8'] })).toThrow('无法在可操作时段内全部收菜')
  })

  it('uses only the required fertilizer and reports per-plot and 24-plot totals', () => {
    const result = plan({ seedIds: ['one-8', 'one-8'], useFertilizer: true })
    expect(result.fertilizerSecondsPerPlot).toBe(4 * 3600)
    expect(result.fertilizerSecondsFor24Plots).toBe(96 * 3600)
    expect(result.crops[0].harvests[0].fertilizerReductionSeconds).toBe(4 * 3600)
    expect(result.crops[1].harvests[0].fertilizerReductionSeconds).toBe(0)
    expect(result.completedAt).toBe(result.windowEndAt)
  })

  it('can split the exact fertilizer need across different seasons', () => {
    const result = plan({
      seedIds: ['two-4', 'one-4'], windowEndTime: '09:00', useFertilizer: true,
    })
    expect(result.fertilizerSecondsPerPlot).toBe(9 * 3600)
    expect(result.crops.flatMap((crop) => crop.harvests.map((harvest) => harvest.fertilizerReductionSeconds)))
      .toEqual([4 * 3600, 4 * 3600, 1 * 3600])
    expect(result.completedAt).toBe(at('2026-10-03T09:00'))
  })

  it('supports a temporary event seed in the selected catalog', () => {
    const result = plan({
      seedIds: ['event-custom'],
      customEventSeeds: [{ id: 'event-custom', growthHours: 4, seasons: 1, experienceWeight: 10 }],
    })
    expect(result.crops[0].seedLabel).toBe('4 小时 · 活动 · 一季')
  })
})

describe('target input validation', () => {
  it('rejects past or invalid dates, invalid windows, and finished time windows', () => {
    expect(() => plan({ date: '2026-10-01' })).toThrow('不能选择过去的日期')
    expect(() => plan({ date: '2026-02-30' })).toThrow('计划日期无效')
    expect(() => plan({ windowStartTime: '24:00' })).toThrow('可操作时段')
    expect(() => plan({ windowStartTime: '20:00' })).toThrow('可操作时段')
    expect(() => plan({ now: at('2026-10-03T20:00') })).toThrow('时段已结束')
  })

  it('rejects missing or unknown seeds and bad custom seed definitions', () => {
    expect(() => plan({ seedIds: [] })).toThrow('请至少加入一次种子')
    expect(() => plan({ seedIds: ['missing'] })).toThrow('种子品类无效')
    const custom = { id: 'custom', growthHours: 4, seasons: 1, experienceWeight: 9 } as const
    expect(() => plan({ customEventSeeds: [custom, custom] })).toThrow('活动种子编号无效或重复')
  })
})
