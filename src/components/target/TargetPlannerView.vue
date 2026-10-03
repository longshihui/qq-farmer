<script setup lang="ts">
import { useTargetSettings } from '@/composables/useTargetSettings'
import { useTargetSeedMarket } from '@/composables/useTargetSeedMarket'
import { useTargetCalculation } from '@/composables/useTargetCalculation'
import TargetPlannerForm from './TargetPlannerForm.vue'
import TargetSeedMarket from './TargetSeedMarket.vue'
import TargetPlannerResult from './TargetPlannerResult.vue'

const settings = useTargetSettings()
const market = useTargetSeedMarket()
const { result, error, generatePlan } = useTargetCalculation(settings, market)
const {
  date, windowStartTime, windowEndTime, land, useFertilizer, landOptions,
  updateDate, updateWindowStartTime, updateWindowEndTime, updateLand,
  updateUseFertilizer, isDateDisabled,
} = settings
const {
  seedGroups, totalSelections, showAddSeedModal, draftGrowthHours, draftSeasons,
  draftWeight, eventSeedError, growthOptions, seasonOptions, addSeed, removeSeed,
  openAddSeed, closeAddSeed, updateDraftGrowthHours, updateDraftWeight,
  addEventSeed, removeEventSeed,
} = market
</script>

<template>
  <div class="target-layout">
    <TargetPlannerForm
      class="target-settings-panel"
      :date="date" :window-start-time="windowStartTime" :window-end-time="windowEndTime"
      :land="land" :land-options="landOptions" :use-fertilizer="useFertilizer"
      :is-date-disabled="isDateDisabled"
      @update-date="updateDate" @update-window-start-time="updateWindowStartTime"
      @update-window-end-time="updateWindowEndTime" @update-land="updateLand"
      @update-use-fertilizer="updateUseFertilizer"
    />
    <div class="target-market-panel">
      <TargetSeedMarket
        :seed-groups="seedGroups" :total-selections="totalSelections"
        :show-add-seed-modal="showAddSeedModal" :draft-growth-hours="draftGrowthHours"
        :draft-seasons="draftSeasons" :draft-weight="draftWeight"
        :event-seed-error="eventSeedError" :growth-options="growthOptions"
        :season-options="seasonOptions" :error="error"
        @add-seed="addSeed" @remove-seed="removeSeed"
        @open-add-seed="openAddSeed" @close-add-seed="closeAddSeed"
        @update-draft-growth-hours="updateDraftGrowthHours"
        @update-draft-weight="updateDraftWeight"
        @add-event-seed="addEventSeed" @remove-event-seed="removeEventSeed"
        @generate-plan="generatePlan"
      />
    </div>
    <TargetPlannerResult class="target-result-panel" :result="result" />
  </div>
</template>

<style scoped>
.target-layout { display: grid; grid-template-columns: minmax(280px, .82fr) minmax(390px, 1.17fr) minmax(340px, 1fr); gap: 20px; align-items: start; }
.target-settings-panel, .target-market-panel, .target-result-panel { min-width: 0; }
@media (max-width: 1179px) {
  .target-layout { grid-template-columns: minmax(280px, .85fr) minmax(0, 1.15fr); }
  .target-result-panel { grid-column: 1 / -1; }
}
@media (max-width: 900px) {
  .target-layout { grid-template-columns: 1fr; }
  .target-result-panel { grid-column: auto; }
}
</style>
