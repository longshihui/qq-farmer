import { computed } from 'vue'
import type { SeasonCount, SeedGroupId } from '@/config'

export interface SeedCardSeed {
  id: string
  growthHours: number
  seasons: SeasonCount
  group: SeedGroupId
  custom: boolean
}

export type SeedIconVariant = 'round' | 'oval' | 'teardrop' | 'pair'

const iconVariants: Record<number, SeedIconVariant> = {
  4: 'round',
  8: 'oval',
  12: 'teardrop',
  24: 'pair',
}

const decreaseButtonTheme = {
  color: '#faf9f3',
  textColor: '#35513b',
  border: '1px solid #aebfa4',
}

interface SeedCardPresentationOptions {
  seed: SeedCardSeed
  mode: 'select' | 'quantity'
  selected: boolean
  count: number
  experienceWeights: readonly number[]
}

export function useSeedCardPresentation(options: SeedCardPresentationOptions) {
  const isEvent = computed(() => options.seed.group === 'event-one' || options.seed.group === 'event-two')
  const isSelected = computed(() => options.mode === 'select' ? options.selected : options.count > 0)
  const kindLabel = computed(() => isEvent.value ? '活动种子' : '常规种子')
  const seasonLabel = computed(() => options.seed.seasons === 1 ? '一季' : '两季')
  const iconVariant = computed(() => iconVariants[options.seed.growthHours] ?? 'round')
  const weightLabel = computed(() => options.experienceWeights.join(' + '))
  const seedLabel = computed(() => {
    const details = [`${seasonLabel.value}${kindLabel.value}`, `生长 ${options.seed.growthHours} 小时`]
    if (weightLabel.value) details.push(`经验权重 ${weightLabel.value}`)
    if (options.seed.custom) details.push('自定义')
    return details.join('，')
  })
  const cardClasses = computed(() => ({
    'seed-packet--event': isEvent.value,
    'seed-packet--selected': isSelected.value,
    'seed-packet--select': options.mode === 'select',
    'seed-packet--quantity': options.mode === 'quantity',
  }))
  const selectionAttributes = computed(() => options.mode === 'select'
    ? { checked: options.selected, 'aria-label': seedLabel.value }
    : {})

  return { isEvent, kindLabel, seasonLabel, iconVariant, weightLabel, seedLabel, cardClasses, selectionAttributes, decreaseButtonTheme }
}
