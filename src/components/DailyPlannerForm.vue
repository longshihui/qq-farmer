<script setup lang="ts">
import {
  NButton, NCard, NCheckbox, NCheckboxGroup, NDatePicker, NForm, NFormItem,
  NInputNumber, NModal, NRadioButton, NRadioGroup, NSelect, NTimePicker,
} from 'naive-ui'
import {
  HARVEST_COUNT_PREFERENCES,
  type GrowthHours, type HarvestCountPreference, type LandType, type SeasonCount,
} from '@/config'

interface SeedDisplay {
  id: string
  growthHours: number
  experienceWeightBySeason: readonly number[]
  custom: boolean
}

interface PlannerFormModel {
  planDate: string
  land: LandType
  landOptions: { value: LandType; label: string }[]
  harvestCountPreference: HarvestCountPreference
  cycleStartTime: string
  sleepWindows: { id: number; start: string; end: string }[]
  selectedSeedIds: string[]
  seedGroups: { id: string; label: string; customSeason: SeasonCount | null; seeds: SeedDisplay[] }[]
  showAddSeedModal: boolean
  draftGrowthHours: GrowthHours
  draftSeasons: SeasonCount
  draftWeight: number | null
  eventSeedError: string | null
  growthOptions: { value: GrowthHours; label: string }[]
  seasonOptions: { value: SeasonCount; label: string }[]
}

defineProps<{ form: PlannerFormModel; error: string | null }>()
const emit = defineEmits<{
  updatePlanDate: [value: string | [string, string] | null]
  updateLand: [value: unknown]
  updateHarvestCountPreference: [value: unknown]
  updateCycleStartTime: [value: string | null]
  updateSleepWindow: [id: number, field: 'start' | 'end', value: string | null]
  addSleepWindow: []
  removeSleepWindow: [id: number]
  updateSeeds: [value: Array<string | number>]
  openAddSeed: [seasons: SeasonCount | null]
  removeEventSeed: [id: string]
  closeAddSeed: []
  updateDraftGrowthHours: [value: unknown]
  updateDraftWeight: [value: number | null]
  addEventSeed: []
  generatePlan: []
}>()
</script>

<template>
  <NCard title="基础规则" class="planner-form-card planner-rules-card">
    <NForm class="planner-field-row" label-placement="top" :show-feedback="false">
      <NFormItem label="日期（北京时间）">
        <NDatePicker
          type="date" format="yyyy-MM-dd" value-format="yyyy-MM-dd"
          :formatted-value="form.planDate" @update:formatted-value="emit('updatePlanDate', $event)"
        />
      </NFormItem>
      <NFormItem label="土地">
        <NSelect :value="form.land" :options="form.landOptions" @update:value="emit('updateLand', $event)" />
      </NFormItem>
      <NFormItem label="收菜次数策略" class="planner-count-field">
        <NRadioGroup class="choice-group" :value="form.harvestCountPreference" @update:value="emit('updateHarvestCountPreference', $event)">
          <NRadioButton
            v-for="option in HARVEST_COUNT_PREFERENCES" :key="option.value"
            :value="option.value" :label="option.label"
          />
        </NRadioGroup>
      </NFormItem>
    </NForm>

    <section class="planner-section" aria-labelledby="cycle-heading">
      <h3 id="cycle-heading" class="planner-section-title">日循环与睡眠</h3>
      <NForm class="planner-time-fields" label-placement="top" :show-feedback="false">
        <NFormItem label="日循环开始时刻（北京时间）">
          <NTimePicker
            format="HH:mm" value-format="HH:mm" :formatted-value="form.cycleStartTime"
            @update:formatted-value="emit('updateCycleStartTime', $event)"
          />
        </NFormItem>
      </NForm>
      <div class="planner-sleep-heading">
        <h4>睡眠时段</h4>
        <NButton secondary size="small" @click="emit('addSleepWindow')">添加时段</NButton>
      </div>
      <div class="planner-sleep-list">
        <div v-for="(window, index) in form.sleepWindows" :key="window.id" class="planner-sleep-row">
          <div class="planner-sleep-row-heading">
            <span>时段 {{ index + 1 }}</span>
            <NButton
              text size="small" :disabled="form.sleepWindows.length === 1"
              :aria-label="`删除睡眠时段 ${index + 1}`"
              @click="emit('removeSleepWindow', window.id)"
            >删除</NButton>
          </div>
          <NForm class="planner-sleep-fields" label-placement="top" :show-feedback="false">
            <NFormItem label="开始">
              <NTimePicker
                format="HH:mm" value-format="HH:mm" :formatted-value="window.start"
                @update:formatted-value="emit('updateSleepWindow', window.id, 'start', $event)"
              />
            </NFormItem>
            <NFormItem label="结束">
              <NTimePicker
                format="HH:mm" value-format="HH:mm" :formatted-value="window.end"
                @update:formatted-value="emit('updateSleepWindow', window.id, 'end', $event)"
              />
            </NFormItem>
          </NForm>
        </div>
      </div>
      <p class="planner-time-hint">从开始时刻起规划 24 小时；每天重复各段睡眠，重叠时自动合并。睡眠期间不播种、不收菜，作物需覆盖整段睡眠。</p>
    </section>

  </NCard>

  <NCard title="种子市场" class="planner-form-card planner-market-card">
    <section class="planner-market-section" aria-label="可用种子">
      <NCheckboxGroup class="seed-checkbox-group" :value="form.selectedSeedIds" @update:value="emit('updateSeeds', $event)">
        <div v-for="group in form.seedGroups" :key="group.id" class="seed-group">
          <div class="seed-group-head">
            <h4>{{ group.label }}</h4>
            <NButton v-if="group.customSeason !== null" text size="small" @click="emit('openAddSeed', group.customSeason)">添加</NButton>
          </div>
          <div class="seed-grid">
            <div v-for="seed in group.seeds" :key="seed.id" class="seed-item" :class="{ 'seed-item--custom': seed.custom }">
              <NCheckbox :value="seed.id" class="seed-choice">
                <span>{{ seed.growthHours }} 小时</span>
                <small><span>经验权重</span><strong>{{ seed.experienceWeightBySeason.join(' + ') }}</strong></small>
              </NCheckbox>
              <NButton
                v-if="seed.custom" text size="tiny" class="seed-remove"
                :aria-label="`删除${group.label}${seed.growthHours}小时种子`"
                @click.stop="emit('removeEventSeed', seed.id)"
              >×</NButton>
            </div>
          </div>
        </div>
      </NCheckboxGroup>
    </section>

    <div class="planner-submit">
      <NButton type="primary" size="large" @click="emit('generatePlan')">生成方案</NButton>
    </div>
    <p v-if="error" class="planner-error" role="alert">{{ error }}</p>
  </NCard>

  <NModal
    :show="form.showAddSeedModal" preset="card" class="add-seed-modal"
    :title="`添加${form.draftSeasons === 1 ? '一季' : '两季'}活动种子`"
    @update:show="(show: boolean) => { if (!show) emit('closeAddSeed') }"
  >
    <NForm label-placement="top" :show-feedback="false">
      <NFormItem label="生长时长">
        <NSelect :value="form.draftGrowthHours" :options="form.growthOptions" @update:value="emit('updateDraftGrowthHours', $event)" />
      </NFormItem>
      <NFormItem label="季数">
        <NSelect :value="form.draftSeasons" :options="form.seasonOptions" disabled />
      </NFormItem>
      <NFormItem :label="form.draftSeasons === 2 ? '第一季经验权重' : '经验权重'">
        <NInputNumber :value="form.draftWeight" :min="0" :step="1" @update:value="emit('updateDraftWeight', $event)" />
      </NFormItem>
      <p class="seed-weight-hint">经验权重用于比较规划方案，不代表游戏实际经验。数值越高越优先；两季种子的第二季经验权重为首季一半。</p>
      <p v-if="form.eventSeedError" class="planner-error" role="alert">{{ form.eventSeedError }}</p>
    </NForm>
    <template #footer>
      <div class="add-seed-actions">
        <NButton @click="emit('closeAddSeed')">取消</NButton>
        <NButton type="primary" @click="emit('addEventSeed')">添加种子</NButton>
      </div>
    </template>
  </NModal>
</template>
