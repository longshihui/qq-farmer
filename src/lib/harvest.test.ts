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

  it.each(expectedMinutes)('%s hours on %s land takes %s minutes', (growthHours, firstLand, minutes) => {
    const result = calculateHarvest({ plantedAt, growthHours, seasons: 1, firstLand, secondLand: 'normal' })
    expect(result.first.readyAt - plantedAt).toBe(minutes * 60 * 1000)
    expect(result.second).toBeUndefined()
  })

  it('applies a separate bonus to the second season and crosses midnight', () => {
    const start = parseBeijingDateTime('2026-09-27T22:00:00')!
    const result = calculateHarvest({
      plantedAt: start,
      growthHours: 8,
      seasons: 2,
      firstLand: 'black',
      secondLand: 'gold',
    })
    expect(toBeijingInput(result.first.readyAt)).toBe('2026-09-28T05:12:00')
    expect(toBeijingInput(result.second!.readyAt)).toBe('2026-09-28T08:24:00')
    expect(result.second!.startSource).toBe('expected-first-harvest')
  })

  it('starts the second season at the actual first harvest', () => {
    const actualFirstHarvestAt = parseBeijingDateTime('2026-09-27T12:00:00')!
    const result = calculateHarvest({
      plantedAt,
      growthHours: 4,
      seasons: 2,
      firstLand: 'gold',
      secondLand: 'black',
      actualFirstHarvestAt,
    })
    expect(toBeijingInput(result.first.readyAt)).toBe('2026-09-27T11:12:00')
    expect(toBeijingInput(result.second!.readyAt)).toBe('2026-09-27T13:48:00')
    expect(result.second!.startSource).toBe('actual-first-harvest')
  })

  it('rejects an actual harvest before first maturity', () => {
    expect(() => calculateHarvest({
      plantedAt,
      growthHours: 4,
      seasons: 2,
      firstLand: 'normal',
      secondLand: 'normal',
      actualFirstHarvestAt: parseBeijingDateTime('2026-09-27T11:59:59'),
    })).toThrow(RangeError)
  })
})

describe('Beijing clock', () => {
  it('interprets entered time as UTC+8 and keeps seconds', () => {
    expect(parseBeijingDateTime('2026-09-27T08:00:09')).toBe(Date.UTC(2026, 8, 27, 0, 0, 9))
    expect(formatBeijingMoment(Date.UTC(2026, 8, 27, 0, 0, 9)).time).toBe('08:00:09')
  })

  it('rejects impossible dates', () => {
    expect(parseBeijingDateTime('2026-02-30T08:00:00')).toBeNull()
    expect(parseBeijingDateTime('2026-09-27T25:00:00')).toBeNull()
  })

  it('reports an elapsed countdown as ready', () => {
    expect(formatCountdown(plantedAt, plantedAt + 1000)).toBe('已经到点，可以收菜')
  })
})
