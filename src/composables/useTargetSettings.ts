import { shallowRef } from 'vue'
import { isLandType, LAND, type LandType } from '@/config'
import { toBeijingInput } from '@/lib/harvest'

export function useTargetSettings() {
  const date = shallowRef(toBeijingInput(Date.now()).slice(0, 10))
  const windowStartTime = shallowRef('08:00')
  const windowEndTime = shallowRef('20:00')
  const land = shallowRef<LandType>('normal')
  const useFertilizer = shallowRef(false)
  const landOptions = (Object.keys(LAND) as LandType[]).map((value) => ({
    value,
    label: `${LAND[value].label} · ${LAND[value].reduction === 0 ? '不缩短' : `缩短 ${LAND[value].reduction}%`}`,
  }))

  function updateDate(value: string | [string, string] | null) {
    date.value = typeof value === 'string' ? value : ''
  }

  function updateWindowStartTime(value: string | null) { windowStartTime.value = value ?? '' }
  function updateWindowEndTime(value: string | null) { windowEndTime.value = value ?? '' }
  function updateLand(value: unknown) { if (isLandType(value)) land.value = value }
  function updateUseFertilizer(value: unknown) { if (typeof value === 'boolean') useFertilizer.value = value }

  function isDateDisabled(timestamp: number): boolean {
    const local = new Date(timestamp)
    const dateText = `${local.getFullYear()}-${String(local.getMonth() + 1).padStart(2, '0')}-${String(local.getDate()).padStart(2, '0')}`
    return dateText < toBeijingInput(Date.now()).slice(0, 10)
  }

  return {
    date, windowStartTime, windowEndTime, land, useFertilizer, landOptions,
    updateDate, updateWindowStartTime, updateWindowEndTime, updateLand,
    updateUseFertilizer, isDateDisabled,
  }
}
