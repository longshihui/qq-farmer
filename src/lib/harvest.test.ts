import { describe, expect, it } from 'vitest'
import {
  calculateHarvest,
  formatBeijingMoment,
  formatCountdown,
  parseBeijingDateTime,
  toBeijingInput,
  type GrowthHours,
  type LandType,
} from './harvest'

const plantedAt = parseBeijingDateTime('2026-09-27T08:00:00')!

describe('calculateHarvest', () => {
  const expectedMinutes: Array<[GrowthHours, LandType, number]> = [
    [4, 'normal', 240], [4, 'black', 216], [4, 'gold', 192],
    [8, 'normal', 480], [8, 'black', 432], [8, 'gold', 384],
    [12, 'normal', 720], [12, 'black', 648], [12, 'gold', 576],
    [24, 'normal', 1440], [24, 'black', 1296], [24, 'gold', 1152],
  ]

  it.each(expectedMinutes)('%s hours on %s land takes %s minutes', (growthHours, land, minutes) => {
    const result = calculateHarvest({ plantedAt, growthHours, seasons: 1, land })
    expect(result.first.readyAt - plantedAt).toBe(minutes * 60 * 1000)
    expect(result.second).toBeUndefined()
  })

  it('uses the same land in both seasons and crosses midnight', () => {
    const start = parseBeijingDateTime('2026-09-27T22:00:00')!
    const result = calculateHarvest({
      plantedAt: start,
      growthHours: 8,
      seasons: 2,
      land: 'black',
    })
    expect(toBeijingInput(result.first.readyAt)).toBe('2026-09-28T05:12')
    expect(toBeijingInput(result.second!.readyAt)).toBe('2026-09-28T08:48')
    expect(result.first.land).toBe('black')
    expect(result.second!.land).toBe('black')
    expect(result.second!.startSource).toBe('expected-first-harvest')
  })

  it('starts the second season at the actual first harvest', () => {
    const actualFirstHarvestAt = parseBeijingDateTime('2026-09-27T12:00:00')!
    const result = calculateHarvest({
      plantedAt,
      growthHours: 4,
      seasons: 2,
      land: 'gold',
      actualFirstHarvestAt,
    })
    expect(toBeijingInput(result.first.readyAt)).toBe('2026-09-27T11:12')
    expect(toBeijingInput(result.second!.readyAt)).toBe('2026-09-27T13:36')
    expect(result.second!.startSource).toBe('actual-first-harvest')
  })

  it('rejects an actual harvest before the earliest first harvest', () => {
    expect(() => calculateHarvest({
      plantedAt,
      growthHours: 4,
      seasons: 2,
      land: 'normal',
      actualFirstHarvestAt: parseBeijingDateTime('2026-09-27T11:59:59'),
    })).toThrow(RangeError)
  })

  it('subtracts each plot’s fertilizer share after the land bonus, on one season only', () => {
    const first = calculateHarvest({
      plantedAt, growthHours: 8, seasons: 2, land: 'gold',
      fertilizer: { season: 1, reductionSeconds: 3600 },
    })
    expect(first.first.durationSeconds).toBe(8 * 3600 * 0.8 - 3600)
    expect(first.second!.durationSeconds).toBe(4 * 3600 * 0.8)

    const second = calculateHarvest({
      plantedAt, growthHours: 8, seasons: 2, land: 'gold',
      fertilizer: { season: 2, reductionSeconds: 3600 },
    })
    expect(second.first.durationSeconds).toBe(8 * 3600 * 0.8)
    expect(second.second!.durationSeconds).toBe(4 * 3600 * 0.8 - 3600)
  })

  it('caps fertilizer reduction at the season duration', () => {
    const result = calculateHarvest({
      plantedAt, growthHours: 4, seasons: 1, land: 'normal',
      fertilizer: { season: 1, reductionSeconds: 100000 },
    })
    expect(result.first.durationSeconds).toBe(0)
    expect(result.first.readyAt).toBe(plantedAt)
  })
})

describe('Beijing clock', () => {
  it('interprets entered minutes as UTC+8 and displays minutes', () => {
    expect(parseBeijingDateTime('2026-09-27T08:00')).toBe(Date.UTC(2026, 8, 27, 0, 0))
    expect(formatBeijingMoment(Date.UTC(2026, 8, 27, 0, 0, 9)).time).toBe('08:00')
    expect(toBeijingInput(Date.UTC(2026, 8, 27, 0, 0, 9))).toBe('2026-09-27T08:00')
  })

  it('rejects impossible dates', () => {
    expect(parseBeijingDateTime('2026-02-30T08:00:00')).toBeNull()
    expect(parseBeijingDateTime('2026-09-27T25:00:00')).toBeNull()
  })

  it('reports an elapsed countdown as ready', () => {
    expect(formatCountdown(plantedAt, plantedAt + 1000)).toBe('已经到点，可以收菜')
  })

  it('rounds remaining time up to a minute without showing seconds', () => {
    expect(formatCountdown(plantedAt + 61000, plantedAt)).toBe('还有 00:02')
    expect(formatCountdown(plantedAt + 60000, plantedAt)).toBe('还有 00:01')
  })
})
