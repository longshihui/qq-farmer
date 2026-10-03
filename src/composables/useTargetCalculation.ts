import { shallowRef, watch } from 'vue'
import { optimizeTargetPlan, type TargetPlanResult } from '@/lib/target-plan'
import type { useTargetSettings } from './useTargetSettings'
import type { useTargetSeedMarket } from './useTargetSeedMarket'

export function useTargetCalculation(
  settings: ReturnType<typeof useTargetSettings>,
  market: ReturnType<typeof useTargetSeedMarket>,
) {
  const result = shallowRef<TargetPlanResult | null>(null)
  const error = shallowRef<string | null>(null)

  watch([
    settings.date, settings.windowStartTime, settings.windowEndTime,
    settings.land, settings.useFertilizer, market.seedIds, market.customEventSeeds,
  ], () => {
    result.value = null
    error.value = null
  }, { deep: true })

  function generatePlan() {
    error.value = null
    result.value = null
    try {
      result.value = optimizeTargetPlan({
        date: settings.date.value,
        windowStartTime: settings.windowStartTime.value,
        windowEndTime: settings.windowEndTime.value,
        land: settings.land.value,
        seedIds: market.seedIds.value,
        customEventSeeds: market.customEventSeeds.value,
        useFertilizer: settings.useFertilizer.value,
        now: Date.now(),
      })
    } catch (cause) {
      error.value = cause instanceof Error ? cause.message : '生成方案失败，请检查输入。'
    }
  }

  return { result, error, generatePlan }
}
