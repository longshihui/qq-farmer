<script setup lang="ts">
import { computed, ref, shallowRef, watch, type Ref } from 'vue'
import {
  DEFAULT_HARVEST_COUNT_PREFERENCE, GROWTH_HOURS,
  isHarvestCountPreference, isLandType, LAND, SEASON_COUNTS, SEED_GROUPS, SEED_TYPES,
  type GrowthHours, type HarvestCountPreference, type LandType, type SeasonCount,
} from '@/config'
import { optimizeDay, type CustomEventSeed, type DailyPlanResult, type SleepWindow } from '@/lib/daily-plan'
import { toBeijingInput } from '@/lib/harvest'
import DailyPlannerForm from './DailyPlannerForm.vue'
import DailyPlannerResult from './DailyPlannerResult.vue'

interface SleepWindowDraft extends SleepWindow {
  id: number
}

function useCycleSettings() {
  const cycleStartTime = shallowRef('08:00')
  const sleepWindows = ref<SleepWindowDraft[]>([{ id: 1, start: '00:00', end: '08:00' }])
  let nextSleepWindowId = 2

  function updateCycleStartTime(value: string | null) { cycleStartTime.value = value ?? '' }
  function updateSleepWindow(id: number, field: 'start' | 'end', value: string | null) {
    const window = sleepWindows.value.find((item) => item.id === id)
    if (window) window[field] = value ?? ''
  }
  function addSleepWindow() {
    sleepWindows.value.push({ id: nextSleepWindowId++, start: '12:00', end: '13:00' })
  }
  function removeSleepWindow(id: number) {
    if (sleepWindows.value.length > 1) {
      sleepWindows.value = sleepWindows.value.filter((window) => window.id !== id)
    }
  }

  return { cycleStartTime, sleepWindows, updateCycleStartTime, updateSleepWindow, addSleepWindow, removeSleepWindow }
}

function useEventSeeds(selectedSeedIds: Ref<string[]>) {
  const customEventSeeds = ref<CustomEventSeed[]>([])
  const showAddSeedModal = shallowRef(false)
  const draftGrowthHours = shallowRef<GrowthHours>(12)
  const draftSeasons = shallowRef<SeasonCount>(1)
  const draftWeight = shallowRef<number | null>(24)
  const eventSeedError = shallowRef<string | null>(null)
  const growthOptions = GROWTH_HOURS.map((hours) => ({ value: hours, label: `${hours} 小时` }))
  const seasonOptions = SEASON_COUNTS.map((seasons) => ({
    value: seasons,
    label: seasons === 1 ? '一季' : '两季',
  }))
  let nextEventSeedId = 1

  function openAddSeed(seasons: SeasonCount | null) {
    if (seasons === null) return
    draftGrowthHours.value = 12
    draftSeasons.value = seasons
    draftWeight.value = 24
    eventSeedError.value = null
    showAddSeedModal.value = true
  }

  function updateDraftGrowthHours(value: unknown) {
    if (typeof value === 'number' && GROWTH_HOURS.some((hours) => hours === value)) {
      draftGrowthHours.value = value as GrowthHours
    }
  }

  function updateDraftWeight(value: number | null) {
    draftWeight.value = value
  }

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
      id: `custom-event-${nextEventSeedId++}`,
      growthHours: draftGrowthHours.value,
      seasons: draftSeasons.value,
      experienceWeight: weight,
    }
    customEventSeeds.value.push(seed)
    selectedSeedIds.value.push(seed.id)
    showAddSeedModal.value = false
    eventSeedError.value = null
  }

  function closeAddSeed() {
    showAddSeedModal.value = false
    eventSeedError.value = null
  }

  function removeEventSeed(id: string) {
    customEventSeeds.value = customEventSeeds.value.filter((seed) => seed.id !== id)
    selectedSeedIds.value = selectedSeedIds.value.filter((seedId) => seedId !== id)
  }

  return {
    customEventSeeds, showAddSeedModal, draftGrowthHours, draftSeasons, draftWeight,
    eventSeedError, growthOptions, seasonOptions, openAddSeed, updateDraftGrowthHours,
    updateDraftWeight, addEventSeed, closeAddSeed, removeEventSeed,
  }
}

function usePlannerInputs() {
  const landOptions = (Object.keys(LAND) as LandType[]).map((value) => ({
    value,
    label: `${LAND[value].label} · ${LAND[value].reduction === 0 ? '不缩短' : `缩短 ${LAND[value].reduction}%`}`,
  }))
  const planDate = shallowRef(toBeijingInput(Date.now()).slice(0, 10))
  const land = shallowRef<LandType>('normal')
  const harvestCountPreference = shallowRef<HarvestCountPreference>(DEFAULT_HARVEST_COUNT_PREFERENCE)
  const selectedSeedIds = ref<string[]>(SEED_TYPES.map((seed) => seed.id))
  const eventSeeds = useEventSeeds(selectedSeedIds)
  const cycleSettings = useCycleSettings()
  const seedGroups = computed(() => SEED_GROUPS.map((group) => ({
    ...group,
    seeds: [
      ...SEED_TYPES.filter((seed) => seed.group === group.id).map((seed) => ({
        id: seed.id,
        growthHours: seed.growthHours,
        experienceWeightBySeason: seed.experienceWeightBySeason,
        custom: false,
      })),
      ...eventSeeds.customEventSeeds.value
        .filter((seed) => seed.seasons === group.customSeason)
        .map((seed) => ({
          id: seed.id,
          growthHours: seed.growthHours,
          experienceWeightBySeason: seed.seasons === 1
            ? [seed.experienceWeight] : [seed.experienceWeight, seed.experienceWeight / 2],
          custom: true,
        })),
    ],
  })))

  function updatePlanDate(value: string | [string, string] | null) {
    planDate.value = typeof value === 'string' ? value : ''
  }

  function updateLand(value: unknown) {
    if (isLandType(value)) land.value = value
  }

  function updateHarvestCountPreference(value: unknown) {
    if (isHarvestCountPreference(value)) harvestCountPreference.value = value
  }

  function updateSeeds(value: Array<string | number>) {
    const validIds = new Set<string>([
      ...SEED_TYPES.map((seed) => seed.id),
      ...eventSeeds.customEventSeeds.value.map((seed) => seed.id),
    ])
    selectedSeedIds.value = value.filter((id): id is string => typeof id === 'string' && validIds.has(id))
  }

  return {
    landOptions, seedGroups, planDate, land, harvestCountPreference, selectedSeedIds,
    updatePlanDate, updateLand, updateHarvestCountPreference, updateSeeds,
    ...cycleSettings,
    ...eventSeeds,
  }
}

function usePlannerResult(inputs: Pick<ReturnType<typeof usePlannerInputs>,
  'planDate' | 'land' | 'harvestCountPreference' | 'selectedSeedIds' | 'customEventSeeds'
  | 'cycleStartTime' | 'sleepWindows'>) {
  const result = shallowRef<DailyPlanResult | null>(null)
  const error = shallowRef<string | null>(null)

  watch([inputs.planDate, inputs.land, inputs.harvestCountPreference,
    inputs.selectedSeedIds, inputs.customEventSeeds,
    inputs.cycleStartTime, inputs.sleepWindows], () => {
    error.value = null
  }, { deep: true })

  function generatePlan() {
    error.value = null
    if (inputs.selectedSeedIds.value.length === 0) {
      error.value = '请至少选择一种可用种子。'
      return
    }

    try {
      result.value = optimizeDay({
        date: inputs.planDate.value,
        cycleStartTime: inputs.cycleStartTime.value,
        sleepWindows: inputs.sleepWindows.value.map(({ start, end }) => ({ start, end })),
        land: inputs.land.value,
        harvestCountPreference: inputs.harvestCountPreference.value,
        seedIds: inputs.selectedSeedIds.value,
        customEventSeeds: inputs.customEventSeeds.value,
        now: Date.now(),
      })
    } catch (cause) {
      error.value = cause instanceof Error ? cause.message : '生成方案失败，请检查输入。'
    }
  }

  return { result, error, generatePlan }
}

const {
  landOptions, seedGroups, planDate, land, harvestCountPreference, selectedSeedIds,
  cycleStartTime, sleepWindows, updateCycleStartTime, updateSleepWindow, addSleepWindow, removeSleepWindow,
  updatePlanDate, updateLand, updateHarvestCountPreference, updateSeeds,
  customEventSeeds, showAddSeedModal, draftGrowthHours, draftSeasons, draftWeight,
  eventSeedError, growthOptions, seasonOptions, openAddSeed, updateDraftGrowthHours,
  updateDraftWeight, addEventSeed, closeAddSeed, removeEventSeed,
} = usePlannerInputs()
const { result, error, generatePlan } = usePlannerResult({
  planDate, land, harvestCountPreference, selectedSeedIds, customEventSeeds,
  cycleStartTime, sleepWindows,
})
const form = computed(() => ({
  landOptions, seedGroups: seedGroups.value, planDate: planDate.value, land: land.value,
  harvestCountPreference: harvestCountPreference.value, selectedSeedIds: selectedSeedIds.value,
  cycleStartTime: cycleStartTime.value, sleepWindows: sleepWindows.value,
  showAddSeedModal: showAddSeedModal.value, draftGrowthHours: draftGrowthHours.value,
  draftSeasons: draftSeasons.value, draftWeight: draftWeight.value, eventSeedError: eventSeedError.value,
  growthOptions, seasonOptions,
}))
</script>

<template>
  <div class="planner-layout">
    <DailyPlannerForm
      :form="form" :error="error"
      @update-plan-date="updatePlanDate"
      @update-land="updateLand"
      @update-harvest-count-preference="updateHarvestCountPreference"
      @update-cycle-start-time="updateCycleStartTime"
      @update-sleep-window="updateSleepWindow"
      @add-sleep-window="addSleepWindow"
      @remove-sleep-window="removeSleepWindow"
      @update-seeds="updateSeeds"
      @open-add-seed="openAddSeed"
      @remove-event-seed="removeEventSeed"
      @close-add-seed="closeAddSeed"
      @update-draft-growth-hours="updateDraftGrowthHours"
      @update-draft-weight="updateDraftWeight"
      @add-event-seed="addEventSeed"
      @generate-plan="generatePlan"
    />
    <DailyPlannerResult :result="result" />
  </div>
</template>
