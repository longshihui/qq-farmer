<script setup lang="ts">
import { computed, ref, shallowRef, watch, type Ref } from 'vue'
import {
  NButton, NCard, NCheckbox, NCheckboxGroup, NDatePicker, NEmpty,
  NForm, NFormItem, NInputNumber, NModal, NRadioButton, NRadioGroup,
  NSelect, NStatistic, NTag, NTimePicker,
  NTimeline, NTimelineItem,
} from 'naive-ui'
import {
  DEFAULT_HARVEST_COUNT_PREFERENCE, GROWTH_HOURS, HARVEST_COUNT_PREFERENCES,
  isHarvestCountPreference, isLandType, LAND, SEASON_COUNTS, SEED_GROUPS, SEED_TYPES,
  type GrowthHours, type HarvestCountPreference, type LandType, type SeasonCount,
} from '@/config'
import { optimizeDay, type CustomEventSeed, type DailyPlanResult } from '@/lib/daily-plan'
import { formatBeijingMoment, toBeijingInput } from '@/lib/harvest'

interface WindowDraft {
  id: number
  start: string
  end: string
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
  const windows = ref<WindowDraft[]>([{ id: 1, start: '00:00', end: '23:59' }])
  let nextWindowId = 2

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

  function updateWindow(id: number, field: 'start' | 'end', value: string | null) {
    const window = windows.value.find((item) => item.id === id)
    if (window) window[field] = value ?? ''
  }

  function addWindow() {
    windows.value.push({ id: nextWindowId++, start: '08:00', end: '12:00' })
  }

  function removeWindow(id: number) {
    windows.value = windows.value.filter((window) => window.id !== id)
  }

  return {
    landOptions, seedGroups, planDate, land, harvestCountPreference, selectedSeedIds, windows,
    updatePlanDate, updateLand, updateHarvestCountPreference, updateSeeds, updateWindow, addWindow, removeWindow,
    ...eventSeeds,
  }
}

function usePlannerResult(inputs: Pick<ReturnType<typeof usePlannerInputs>,
  'planDate' | 'land' | 'harvestCountPreference' | 'selectedSeedIds' | 'customEventSeeds' | 'windows'>) {
  const result = shallowRef<DailyPlanResult | null>(null)
  const error = shallowRef<string | null>(null)

  watch([inputs.planDate, inputs.land, inputs.harvestCountPreference,
    inputs.selectedSeedIds, inputs.customEventSeeds, inputs.windows], () => {
    error.value = null
  }, { deep: true })

  const combination = computed(() => {
    const counts = new Map<string, { id: string; label: string; count: number }>()
    for (const crop of result.value?.crops ?? []) {
      const item = counts.get(crop.seedId)
      if (item) item.count++
      else counts.set(crop.seedId, { id: crop.seedId, label: crop.seedLabel, count: 1 })
    }
    return [...counts.values()]
  })
  const resultPreferenceLabel = computed(() =>
    HARVEST_COUNT_PREFERENCES.find((option) => option.value === result.value?.harvestCountPreference)?.label ?? '')

  function generatePlan() {
    error.value = null
    if (inputs.windows.value.length === 0) {
      error.value = '请至少添加一个可操作时段。'
      return
    }
    if (inputs.selectedSeedIds.value.length === 0) {
      error.value = '请至少选择一种可用种子。'
      return
    }

    try {
      result.value = optimizeDay({
        date: inputs.planDate.value,
        land: inputs.land.value,
        harvestCountPreference: inputs.harvestCountPreference.value,
        seedIds: inputs.selectedSeedIds.value,
        customEventSeeds: inputs.customEventSeeds.value,
        windows: inputs.windows.value.map(({ start, end }) => ({ start, end })),
        now: Date.now(),
      })
    } catch (cause) {
      error.value = cause instanceof Error ? cause.message : '生成方案失败，请检查输入。'
    }
  }

  function timeAt(timestamp: number): string {
    return formatBeijingMoment(timestamp).time
  }

  return { result, error, combination, resultPreferenceLabel, generatePlan, timeAt }
}

const {
  landOptions, seedGroups, planDate, land, harvestCountPreference, selectedSeedIds, windows,
  updatePlanDate, updateLand, updateHarvestCountPreference, updateSeeds, updateWindow, addWindow, removeWindow,
  customEventSeeds, showAddSeedModal, draftGrowthHours, draftSeasons, draftWeight,
  eventSeedError, growthOptions, seasonOptions, openAddSeed, updateDraftGrowthHours,
  updateDraftWeight, addEventSeed, closeAddSeed, removeEventSeed,
} = usePlannerInputs()
const { result, error, combination, resultPreferenceLabel, generatePlan, timeAt } = usePlannerResult({
  planDate, land, harvestCountPreference, selectedSeedIds, customEventSeeds, windows,
})
</script>

<template>
  <div class="planner-layout">
    <NCard title="规划条件" class="planner-form-card">
      <NForm class="planner-field-row" label-placement="top" :show-feedback="false">
        <NFormItem label="日期（北京时间）">
          <NDatePicker
            type="date" format="yyyy-MM-dd" value-format="yyyy-MM-dd"
            :formatted-value="planDate" @update:formatted-value="updatePlanDate"
          />
        </NFormItem>
        <NFormItem label="土地">
          <NSelect :value="land" :options="landOptions" @update:value="updateLand" />
        </NFormItem>
        <NFormItem label="最高经验权重下的收菜次数" class="planner-count-field">
          <NRadioGroup class="choice-group" :value="harvestCountPreference" @update:value="updateHarvestCountPreference">
            <NRadioButton
              v-for="option in HARVEST_COUNT_PREFERENCES" :key="option.value"
              :value="option.value" :label="option.label"
            />
          </NRadioGroup>
        </NFormItem>
      </NForm>

      <section class="planner-section" aria-labelledby="windows-heading">
        <div class="planner-section-head">
          <h3 id="windows-heading">可操作时段</h3>
          <NButton secondary size="small" @click="addWindow">添加时段</NButton>
        </div>
        <div class="window-list">
          <div v-for="(window, index) in windows" :key="window.id" class="window-row">
            <span class="window-index">{{ String(index + 1).padStart(2, '0') }}</span>
            <div class="window-time">
              <span>开始</span>
              <NTimePicker
                format="HH:mm" value-format="HH:mm" :formatted-value="window.start"
                @update:formatted-value="(value: string | null) => updateWindow(window.id, 'start', value)"
              />
            </div>
            <span class="window-dash" aria-hidden="true">—</span>
            <div class="window-time">
              <span>结束</span>
              <NTimePicker
                format="HH:mm" value-format="HH:mm" :formatted-value="window.end"
                @update:formatted-value="(value: string | null) => updateWindow(window.id, 'end', value)"
              />
            </div>
            <NButton text class="remove-window" :aria-label="`删除第 ${index + 1} 个时段`" @click="removeWindow(window.id)">删除</NButton>
          </div>
          <NEmpty v-if="windows.length === 0" description="请添加时段" size="small" />
        </div>
      </section>

      <section class="planner-section" aria-labelledby="seeds-heading">
        <h3 id="seeds-heading" class="planner-section-title">可用种子</h3>
        <NCheckboxGroup class="seed-checkbox-group" :value="selectedSeedIds" @update:value="updateSeeds">
          <div v-for="group in seedGroups" :key="group.id" class="seed-group">
            <div class="seed-group-head">
              <h4>{{ group.label }}</h4>
              <NButton v-if="group.customSeason !== null" text size="small" @click="openAddSeed(group.customSeason)">
                添加
              </NButton>
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
                  @click.stop="removeEventSeed(seed.id)"
                >×</NButton>
              </div>
            </div>
          </div>
        </NCheckboxGroup>
      </section>

      <div class="planner-submit">
        <NButton type="primary" size="large" @click="generatePlan">生成方案</NButton>
      </div>
      <p v-if="error" class="planner-error" role="alert">{{ error }}</p>
    </NCard>

    <section class="planner-result-column" aria-label="全天规划结果">
      <NCard title="推荐方案" class="planner-result-card">
        <template v-if="result && result.crops.length > 0">
          <p class="planner-result-date">{{ formatBeijingMoment(result.planningFromAt).date }} · {{ LAND[result.land].label }} · {{ resultPreferenceLabel }}</p>
          <div class="planner-stats">
            <NStatistic label="经验权重" :value="result.totalExperienceWeight" />
            <NStatistic label="收获次数" :value="result.harvestCount" />
            <NStatistic label="种植株数" :value="result.crops.length" />
          </div>

          <div class="combination-block">
            <h3>推荐种子组合</h3>
            <div class="combination-list">
              <NTag v-for="item in combination" :key="item.id" type="success" :bordered="false" size="small">
                {{ item.label }} × {{ item.count }}
              </NTag>
            </div>
          </div>

          <NTimeline class="plan-timeline">
            <NTimelineItem
              v-for="(crop, index) in result.crops" :key="index"
              :title="`${timeAt(crop.plantedAt)} 播种 · ${crop.seedLabel}`"
            >
              <div v-for="harvest in crop.harvests" :key="harvest.season" class="season-row">
                <span>第{{ harvest.season === 1 ? '一' : '二' }}季</span>
                <strong><time :datetime="new Date(harvest.harvestAt).toISOString()">{{ timeAt(harvest.harvestAt) }}</time> 收菜</strong>
                <NTag type="success" :bordered="false" size="small">经验权重 +{{ harvest.experienceWeight }}</NTag>
                <small v-if="harvest.harvestAt > harvest.readyAt">{{ timeAt(harvest.readyAt) }} 成熟</small>
              </div>
            </NTimelineItem>
          </NTimeline>
          <p class="planner-result-note">{{ timeAt(result.generatedAt) }} 生成</p>
        </template>
        <div v-else-if="result" class="planner-empty-result">
          <NEmpty description="当天没有可完成的种植方案" />
        </div>
        <div v-else class="planner-empty-result">
          <NEmpty description="点击生成方案" />
        </div>
      </NCard>
    </section>

    <NModal v-model:show="showAddSeedModal" preset="card" class="add-seed-modal" :title="`添加${draftSeasons === 1 ? '一季' : '两季'}活动种子`">
      <NForm label-placement="top" :show-feedback="false">
        <NFormItem label="生长时长">
          <NSelect :value="draftGrowthHours" :options="growthOptions" @update:value="updateDraftGrowthHours" />
        </NFormItem>
        <NFormItem label="季数">
          <NSelect :value="draftSeasons" :options="seasonOptions" disabled />
        </NFormItem>
        <NFormItem :label="draftSeasons === 2 ? '第一季经验权重' : '经验权重'">
          <NInputNumber :value="draftWeight" :min="0" :step="1" @update:value="updateDraftWeight" />
        </NFormItem>
        <p class="seed-weight-hint">经验权重用于比较规划方案，不代表游戏实际经验。数值越高越优先；两季种子的第二季经验权重为首季一半。</p>
        <p v-if="eventSeedError" class="planner-error" role="alert">{{ eventSeedError }}</p>
      </NForm>
      <template #footer>
        <div class="add-seed-actions">
          <NButton @click="closeAddSeed">取消</NButton>
          <NButton type="primary" @click="addEventSeed">添加种子</NButton>
        </div>
      </template>
    </NModal>
  </div>
</template>
