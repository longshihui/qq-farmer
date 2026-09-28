<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import {
  NButton, NCard, NConfigProvider,
  NDatePicker, NDescriptions, NDescriptionsItem, NEmpty, NForm,
  NFormItem, NRadioButton, NRadioGroup, NSelect,
  NTag, NTimeline, NTimelineItem, dateZhCN, zhCN,
} from 'naive-ui'
import {
  calculateHarvest, formatBeijingMoment, formatCountdown,
  formatDuration, GROWTH_HOURS, LAND, parseBeijingDateTime,
  toBeijingInput, type GrowthHours, type HarvestSchedule,
  type LandType, type SeasonCount, type SeasonSchedule,
} from '@/lib/harvest'

interface ViewState {
  schedule: HarvestSchedule | null
  plantingError: string | null
  actualError: string | null
}

const landOptions = (Object.keys(LAND) as LandType[]).map((value) => ({
  value,
  label: `${LAND[value].label} · ${LAND[value].reduction === 0 ? '不缩短' : `缩短 ${LAND[value].reduction}%`}`,
}))
const pickerActions: Array<'clear' | 'confirm'> = ['clear', 'confirm']

const now = ref(Date.now())
const plantedAtInput = ref<string | null>(toBeijingInput(now.value))
const growthHours = ref<GrowthHours>(4)
const seasons = ref<SeasonCount>(1)
const firstLand = ref<LandType>('normal')
const secondLand = ref<LandType>('normal')
const actualFirstHarvestInput = ref<string | null>(null)
const detailsExpanded = ref(false)
let clockTimer: number | undefined

const view = computed<ViewState>(() => {
  const plantedAt = parseBeijingDateTime(plantedAtInput.value ?? '')
  if (plantedAt === null) {
    return { schedule: null, plantingError: '请输入有效的播种时间。', actualError: null }
  }

  const baseInput = {
    plantedAt,
    growthHours: growthHours.value,
    seasons: seasons.value,
    firstLand: firstLand.value,
    secondLand: secondLand.value,
  }
  const baseSchedule = calculateHarvest(baseInput)
  if (seasons.value === 1 || !actualFirstHarvestInput.value) {
    return { schedule: baseSchedule, plantingError: null, actualError: null }
  }

  const actualFirstHarvestAt = parseBeijingDateTime(actualFirstHarvestInput.value)
  if (actualFirstHarvestAt === null) {
    return { schedule: baseSchedule, plantingError: null, actualError: '请输入有效的第一次实际收菜时间。' }
  }
  if (actualFirstHarvestAt < baseSchedule.first.readyAt) {
    return { schedule: baseSchedule, plantingError: null, actualError: '实际收菜时间不能早于第一季成熟时间。' }
  }

  return {
    schedule: calculateHarvest({ ...baseInput, actualFirstHarvestAt }),
    plantingError: null,
    actualError: null,
  }
})

const first = computed(() => view.value.schedule?.first)
const second = computed(() => view.value.actualError ? undefined : view.value.schedule?.second)
const actualFirstHarvestAt = computed(() => actualFirstHarvestInput.value
  ? parseBeijingDateTime(actualFirstHarvestInput.value)
  : null)

function updatePlantedAt(value: string | [string, string] | null) {
  plantedAtInput.value = typeof value === 'string' ? value : null
}

function updateActualHarvest(value: string | [string, string] | null) {
  actualFirstHarvestInput.value = typeof value === 'string' ? value : null
}

function updateGrowthHours(value: unknown) {
  if (typeof value === 'number' && GROWTH_HOURS.some((hours) => hours === value)) {
    growthHours.value = value as GrowthHours
  }
}

function updateSeasons(value: unknown) {
  if (value === 1 || value === 2) seasons.value = value
}

function isLandType(value: unknown): value is LandType {
  return value === 'normal' || value === 'black' || value === 'gold'
}

function updateFirstLand(value: unknown) {
  if (isLandType(value)) firstLand.value = value
}

function updateSecondLand(value: unknown) {
  if (isLandType(value)) secondLand.value = value
}

function useCurrentTime() {
  now.value = Date.now()
  plantedAtInput.value = toBeijingInput(now.value)
}

function reset() {
  now.value = Date.now()
  plantedAtInput.value = toBeijingInput(now.value)
  growthHours.value = 4
  seasons.value = 1
  firstLand.value = 'normal'
  secondLand.value = 'normal'
  actualFirstHarvestInput.value = null
}

function seasonFormula(schedule: SeasonSchedule): string {
  return `${formatDuration(schedule.baseDurationSeconds)} × ${(LAND[schedule.land].tenths / 10).toFixed(1)} = ${formatDuration(schedule.durationSeconds)}`
}

onMounted(() => {
  clockTimer = window.setInterval(() => { now.value = Date.now() }, 1000)
})

onUnmounted(() => {
  if (clockTimer !== undefined) window.clearInterval(clockTimer)
})
</script>

<template>
  <NConfigProvider :locale="zhCN" :date-locale="dateZhCN">
    <main class="page-shell">
      <header class="page-header">
        <h1>田间时刻</h1>
        <p>设置种植条件，查看每季收菜时间。所有时间均按北京时间计算。</p>
      </header>

      <div class="content-grid">
        <NCard title="种植条件" class="form-card">
          <template #header-extra><NButton text @click="reset">重置</NButton></template>
          <NForm label-placement="top" :show-feedback="false">
            <NFormItem label="播种时间">
              <div class="datetime-row">
                <NDatePicker
                  class="datetime-picker" type="datetime" format="yyyy-MM-dd HH:mm"
                  value-format="yyyy-MM-dd'T'HH:mm" :time-picker-props="{ format: 'HH:mm' }"
                  :formatted-value="plantedAtInput" :actions="pickerActions" clearable
                  @update:formatted-value="updatePlantedAt"
                />
                <NButton @click="useCurrentTime">此刻</NButton>
              </div>
            </NFormItem>
            <p v-if="view.plantingError" class="field-error" role="alert">{{ view.plantingError }}</p>

            <NFormItem label="作物生长时间">
              <NRadioGroup class="choice-group" :value="growthHours" @update:value="updateGrowthHours">
                <NRadioButton v-for="hours in GROWTH_HOURS" :key="hours" :value="hours" :label="`${hours} 小时`" />
              </NRadioGroup>
            </NFormItem>

            <NFormItem label="收获季数">
              <NRadioGroup class="choice-group" :value="seasons" @update:value="updateSeasons">
                <NRadioButton :value="1" label="一季" />
                <NRadioButton :value="2" label="两季" />
              </NRadioGroup>
            </NFormItem>

            <NFormItem label="第一季土地">
              <NSelect :value="firstLand" :options="landOptions" @update:value="updateFirstLand" />
            </NFormItem>

            <template v-if="seasons === 2">
              <NFormItem label="第二季土地">
                <NSelect :value="secondLand" :options="landOptions" @update:value="updateSecondLand" />
              </NFormItem>
              <NFormItem label="第一次实际收菜时间（可选）">
                <NDatePicker
                  class="datetime-picker" type="datetime" format="yyyy-MM-dd HH:mm"
                  value-format="yyyy-MM-dd'T'HH:mm" :time-picker-props="{ format: 'HH:mm' }"
                  :formatted-value="actualFirstHarvestInput" :actions="pickerActions" clearable
                  @update:formatted-value="updateActualHarvest"
                />
              </NFormItem>
              <p v-if="view.actualError" class="field-error" role="alert">{{ view.actualError }}</p>
              <p v-else class="field-hint">留空时，按第一季成熟后立即收菜估算。</p>
            </template>
          </NForm>
        </NCard>

        <section class="results-column" aria-label="收菜时间结果">
          <NCard title="第一季" class="result-card">
            <template v-if="first">
              <p class="result-date">{{ formatBeijingMoment(first.readyAt).date }}</p>
              <time class="result-time" :datetime="new Date(first.readyAt).toISOString()">{{ formatBeijingMoment(first.readyAt).time }}</time>
              <NTag :type="first.readyAt <= now ? 'success' : 'info'" round>{{ formatCountdown(first.readyAt, now) }}</NTag>
            </template>
            <NEmpty v-else description="填写播种时间后显示结果" />
          </NCard>

          <NCard v-if="seasons === 2" title="第二季" class="result-card">
            <template #header-extra>
              <span class="result-source">{{ actualFirstHarvestInput && !view.actualError ? '按实际收菜时间' : '预计时间' }}</span>
            </template>
            <template v-if="second">
              <p class="result-date">{{ formatBeijingMoment(second.readyAt).date }}</p>
              <time class="result-time" :datetime="new Date(second.readyAt).toISOString()">{{ formatBeijingMoment(second.readyAt).time }}</time>
              <NTag :type="second.readyAt <= now ? 'success' : 'info'" round>{{ formatCountdown(second.readyAt, now) }}</NTag>
            </template>
            <NEmpty v-else :description="view.actualError ? '请修正第一次实际收菜时间' : '填写播种时间后显示结果'" />
          </NCard>

          <NCard title="计算说明" class="details-card" :class="{ 'is-collapsed': !detailsExpanded }">
            <template #header-extra>
              <NButton text :aria-expanded="detailsExpanded" @click="detailsExpanded = !detailsExpanded">
                {{ detailsExpanded ? '收起' : '展开' }}
              </NButton>
            </template>
            <template v-if="detailsExpanded && first">
              <NTimeline>
                <NTimelineItem title="播种" :time="formatBeijingMoment(first.startAt).full" />
                <NTimelineItem title="第一季成熟" :time="formatBeijingMoment(first.readyAt).full" />
                <NTimelineItem
                  v-if="second && second.startSource === 'actual-first-harvest' && actualFirstHarvestAt !== null"
                  title="第一次实际收菜 · 第二季起算" :time="formatBeijingMoment(actualFirstHarvestAt).full"
                />
                <NTimelineItem v-if="second" title="第二季成熟" :time="formatBeijingMoment(second.readyAt).full" />
              </NTimeline>
              <NDescriptions label-placement="left" :column="1" bordered size="small">
                <NDescriptionsItem :label="`第一季 · ${LAND[first.land].label}`">{{ seasonFormula(first) }}</NDescriptionsItem>
                <NDescriptionsItem v-if="second" :label="`第二季 · ${LAND[second.land].label}`">{{ seasonFormula(second) }}</NDescriptionsItem>
              </NDescriptions>
              <p v-if="second" class="calculation-note">
                第二季从{{ second.startSource === 'actual-first-harvest' ? '第一次实际收菜时间' : '第一季预计成熟时间' }}开始计算。
              </p>
            </template>
            <NEmpty v-else-if="detailsExpanded" description="填写播种时间后显示计算过程" />
          </NCard>
        </section>
      </div>
    </main>
  </NConfigProvider>
</template>
