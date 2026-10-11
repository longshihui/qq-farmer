<script setup lang="ts">
import {
  NButton, NCard, NForm, NFormItem, NInputNumber, NModal, NSelect, NTag,
} from 'naive-ui'
import type { GrowthHours, SeasonCount } from '@/config'

interface SeedDisplay {
  id: string
  growthHours: number
  seasons: SeasonCount
  experienceWeight: number
  custom: boolean
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
        <div v-for="seed in group.seeds" :key="seed.id" class="target-seed" :class="{ 'target-seed--selected': seed.count > 0 }">
          <div class="target-seed-info">
            <strong>{{ seed.growthHours }} 小时 · {{ seed.seasons === 1 ? '一季' : '两季' }}</strong>
            <small v-if="seed.custom">活动种子 · 经验权重 {{ seed.experienceWeight }}</small>
          </div>
          <div class="target-seed-actions">
            <NButton size="tiny" :disabled="seed.count === 0" :aria-label="`减少${group.label}${seed.growthHours}小时种子`" @click="emit('removeSeed', seed.id)">−</NButton>
            <NTag :bordered="false" type="success" size="small">× {{ seed.count }}</NTag>
            <NButton size="tiny" type="primary" secondary :aria-label="`加入${group.label}${seed.growthHours}小时种子`" @click="emit('addSeed', seed.id)">加入</NButton>
            <NButton v-if="seed.custom" text size="tiny" :aria-label="`删除${group.label}${seed.growthHours}小时活动种子`" @click="emit('removeEventSeed', seed.id)">删除</NButton>
          </div>
        </div>
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
.target-seed-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 168px), 1fr)); gap: 10px; margin-top: 10px; }
.target-seed { display: flex; min-width: 0; flex-direction: column; justify-content: space-between; gap: 16px; padding: 14px; border: 1px solid var(--field-line); border-radius: 12px; background: var(--field-surface-soft, #fafbf7); transition: background-color 160ms ease, border-color 160ms ease, box-shadow 160ms ease; }
.target-seed:hover { border-color: var(--field-green); }
.target-seed--selected { border-color: var(--field-green); background: var(--field-green-soft, #edf3e8); box-shadow: 0 2px 8px #334a3210; }
.target-seed-info { display: flex; min-width: 0; flex-direction: column; gap: 5px; }
.target-seed-info strong { color: var(--field-ink); font-size: 14px; font-weight: 600; }
.target-seed-info small { color: var(--field-muted); font-size: 12px; overflow-wrap: anywhere; }
.target-seed-actions { display: flex; align-items: center; flex-wrap: wrap; gap: 7px; }
.target-seed-actions .n-tag { min-width: 36px; justify-content: center; font-variant-numeric: tabular-nums; }
.target-submit { display: flex; align-items: stretch; flex-direction: column; gap: 12px; margin-top: 24px; padding-top: 20px; border-top: 1px solid var(--field-line); }
.target-submit span { color: var(--field-muted); font-size: 12px; text-align: center; font-variant-numeric: tabular-nums; }
@media (prefers-reduced-motion: reduce) { .target-seed { transition: none; } }
</style>
