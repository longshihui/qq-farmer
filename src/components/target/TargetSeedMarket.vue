<script setup lang="ts">
import {
  NButton, NCard, NForm, NFormItem, NInputNumber, NModal, NSelect,
} from 'naive-ui'
import type { GrowthHours, SeasonCount } from '@/config'
import SeedPacketCard from '@/components/seeds/SeedPacketCard.vue'
import type { SeedCardSeed } from '@/composables/useSeedCardPresentation'

interface SeedDisplay extends SeedCardSeed {
  experienceWeightBySeason: readonly number[]
  count: number
}

defineProps<{
  seedGroups: { id: string; label: string; customSeason: SeasonCount | null; seeds: SeedDisplay[] }[]
  totalSelections: number
  showAddSeedModal: boolean
  draftGrowthHours: GrowthHours
  draftSeasons: SeasonCount
  draftWeight: number | null
  eventSeedError: string | null
  growthOptions: { value: GrowthHours; label: string }[]
  seasonOptions: { value: SeasonCount; label: string }[]
  error: string | null
}>()

const emit = defineEmits<{
  addSeed: [id: string]
  removeSeed: [id: string]
  openAddSeed: [seasons: SeasonCount | null]
  closeAddSeed: []
  updateDraftGrowthHours: [value: unknown]
  updateDraftWeight: [value: number | null]
  addEventSeed: []
  removeEventSeed: [id: string]
  generatePlan: []
}>()
</script>

<template>
  <NCard class="planner-form-card target-card">
    <template #header>
      <div class="panel-heading">
        <span class="panel-step" aria-hidden="true">02</span>
        <span class="panel-title">种子市场</span>
      </div>
    </template>
    <p class="target-market-hint">每点击一次“加入”，就安排播种一次；相同种子可以重复加入。</p>
    <section v-for="group in seedGroups" :key="group.id" class="target-seed-group">
      <div class="seed-group-head">
        <h3>{{ group.label }}</h3>
        <NButton v-if="group.customSeason !== null" text size="small" @click="emit('openAddSeed', group.customSeason)">添加活动种子</NButton>
      </div>
      <div class="target-seed-grid">
        <SeedPacketCard
          v-for="seed in group.seeds" :key="seed.id"
          :seed="seed" mode="quantity" :count="seed.count"
          :experience-weights="seed.experienceWeightBySeason"
          @add="emit('addSeed', $event)" @remove="emit('removeSeed', $event)"
          @delete="emit('removeEventSeed', $event)"
        />
      </div>
    </section>
    <div class="target-submit">
      <span>已加入 {{ totalSelections }} 次播种</span>
      <NButton type="primary" size="large" @click="emit('generatePlan')">生成目标方案</NButton>
    </div>
    <p v-if="error" class="planner-error" role="alert">{{ error }}</p>
  </NCard>

  <NModal
    :show="showAddSeedModal" preset="card" class="add-seed-modal"
    :title="`添加${draftSeasons === 1 ? '一季' : '两季'}活动种子`"
    @update:show="(show: boolean) => { if (!show) emit('closeAddSeed') }"
  >
    <NForm label-placement="top" :show-feedback="false">
      <NFormItem label="生长时长">
        <NSelect :value="draftGrowthHours" :options="growthOptions" @update:value="emit('updateDraftGrowthHours', $event)" />
      </NFormItem>
      <NFormItem label="季数">
        <NSelect :value="draftSeasons" :options="seasonOptions" disabled />
      </NFormItem>
      <NFormItem label="经验权重">
        <NInputNumber :value="draftWeight" :min="0" :step="1" @update:value="emit('updateDraftWeight', $event)" />
      </NFormItem>
      <p class="target-market-hint">经验权重用于区分活动种子配置，不影响目标种植的排序。</p>
      <p v-if="eventSeedError" class="planner-error" role="alert">{{ eventSeedError }}</p>
    </NForm>
    <template #footer>
      <div class="add-seed-actions">
        <NButton @click="emit('closeAddSeed')">取消</NButton>
        <NButton type="primary" @click="emit('addEventSeed')">添加并加入一次</NButton>
      </div>
    </template>
  </NModal>
</template>

<style scoped>
.target-market-hint { margin: 0; color: var(--field-muted); font-size: 12px; line-height: 1.8; }
.target-seed-group { margin-top: 24px; }
.target-seed-group h3 { margin: 0; color: var(--field-ink); font-size: 13px; font-weight: 600; }
.target-seed-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, max(146px, calc(50% - 6px))), 1fr)); gap: 12px; margin-top: 10px; }
.target-submit { display: flex; align-items: stretch; flex-direction: column; gap: 12px; margin-top: 24px; padding-top: 20px; border-top: 1px solid var(--field-line); }
.target-submit span { color: var(--field-muted); font-size: 12px; text-align: center; font-variant-numeric: tabular-nums; }
</style>
