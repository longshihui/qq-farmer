import { computed, ref, shallowRef } from 'vue'
import { GROWTH_HOURS, SEASON_COUNTS, SEED_GROUPS, SEED_TYPES, type GrowthHours, type SeasonCount } from '@/config'
import type { CustomEventSeed } from '@/lib/daily-plan'

export function useTargetSeedMarket() {
  const seedIds = ref<string[]>([])
  const customEventSeeds = ref<CustomEventSeed[]>([])
  const showAddSeedModal = shallowRef(false)
  const draftGrowthHours = shallowRef<GrowthHours>(12)
  const draftSeasons = shallowRef<SeasonCount>(1)
  const draftWeight = shallowRef<number | null>(24)
  const eventSeedError = shallowRef<string | null>(null)
  const growthOptions = GROWTH_HOURS.map((hours) => ({ value: hours, label: `${hours} 小时` }))
  const seasonOptions = SEASON_COUNTS.map((seasons) => ({
    value: seasons, label: seasons === 1 ? '一季' : '两季',
  }))
  let nextEventSeedId = 1

  const seedGroups = computed(() => SEED_GROUPS.map((group) => ({
    ...group,
    seeds: [
      ...SEED_TYPES.filter((seed) => seed.group === group.id).map((seed) => ({
        id: seed.id, growthHours: seed.growthHours, seasons: seed.seasons,
        experienceWeight: seed.experienceWeightBySeason[0],
        custom: false, count: seedIds.value.filter((id) => id === seed.id).length,
      })),
      ...customEventSeeds.value.filter((seed) => seed.seasons === group.customSeason).map((seed) => ({
        id: seed.id, growthHours: seed.growthHours, seasons: seed.seasons,
        experienceWeight: seed.experienceWeight,
        custom: true, count: seedIds.value.filter((id) => id === seed.id).length,
      })),
    ],
  })))
  const totalSelections = computed(() => seedIds.value.length)

  function addSeed(id: string) {
    if (SEED_TYPES.some((seed) => seed.id === id) || customEventSeeds.value.some((seed) => seed.id === id)) {
      seedIds.value.push(id)
    }
  }

  function removeSeed(id: string) {
    const index = seedIds.value.lastIndexOf(id)
    if (index >= 0) seedIds.value.splice(index, 1)
  }

  function openAddSeed(seasons: SeasonCount | null) {
    if (seasons === null) return
    draftGrowthHours.value = 12
    draftSeasons.value = seasons
    draftWeight.value = 24
    eventSeedError.value = null
    showAddSeedModal.value = true
  }

  function closeAddSeed() {
    showAddSeedModal.value = false
    eventSeedError.value = null
  }

  function updateDraftGrowthHours(value: unknown) {
    if (typeof value === 'number' && GROWTH_HOURS.some((hours) => hours === value)) {
      draftGrowthHours.value = value as GrowthHours
    }
  }

  function updateDraftWeight(value: number | null) { draftWeight.value = value }

  function addEventSeed() {
    const weight = draftWeight.value
    if (weight === null || !Number.isFinite(weight) || weight <= 0) {
      eventSeedError.value = '请输入大于 0 的经验权重。'
      return
    }
    const group = draftSeasons.value === 1 ? 'event-one' : 'event-two'
    const duplicate = SEED_TYPES.some((seed) => seed.group === group
      && seed.growthHours === draftGrowthHours.value && seed.experienceWeightBySeason[0] === weight)
      || customEventSeeds.value.some((seed) => seed.seasons === draftSeasons.value
        && seed.growthHours === draftGrowthHours.value && seed.experienceWeight === weight)
    if (duplicate) {
      eventSeedError.value = '相同配置的活动种子已存在。'
      return
    }
    const seed: CustomEventSeed = {
      id: `target-event-${nextEventSeedId++}`, growthHours: draftGrowthHours.value,
      seasons: draftSeasons.value, experienceWeight: weight,
    }
    customEventSeeds.value.push(seed)
    seedIds.value.push(seed.id)
    closeAddSeed()
  }

  function removeEventSeed(id: string) {
    customEventSeeds.value = customEventSeeds.value.filter((seed) => seed.id !== id)
    seedIds.value = seedIds.value.filter((seedId) => seedId !== id)
  }

  return {
    seedIds, customEventSeeds, seedGroups, totalSelections,
    showAddSeedModal, draftGrowthHours, draftSeasons, draftWeight, eventSeedError,
    growthOptions, seasonOptions, addSeed, removeSeed, openAddSeed, closeAddSeed,
    updateDraftGrowthHours, updateDraftWeight, addEventSeed, removeEventSeed,
  }
}
