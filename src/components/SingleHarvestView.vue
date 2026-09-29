<script setup lang="ts">
import { computed, shallowRef } from 'vue'
import {
  NButton, NCard, NDatePicker, NDescriptions, NDescriptionsItem,
  NEmpty, NForm, NFormItem, NRadioButton, NRadioGroup,
  NSelect, NTimeline, NTimelineItem,
} from 'naive-ui'
import {
  GROWTH_HOURS, isLandType, LAND, SEASON_COUNTS,
  type GrowthHours, type LandType, type SeasonCount,
} from '@/config'
import {
  calculateHarvest, formatBeijingMoment, formatDuration,
  parseBeijingDateTime, toBeijingInput,
  type HarvestSchedule, type SeasonSchedule,
} from '@/lib/harvest'

interface ViewState {
  schedule: HarvestSchedule | null
  plantingError: string | null
  actualError: string | null
}

function useHarvestForm() {
  const landOptions = (Object.keys(LAND) as LandType[]).map((value) => ({
    value,
    label: `${LAND[value].label} · ${LAND[value].reduction === 0 ? '不缩短' : `缩短 ${LAND[value].reduction}%`}`,
  }))
  const pickerActions: Array<'clear' | 'confirm'> = ['clear', 'confirm']
  const plantedAtInput = shallowRef<string | null>(toBeijingInput(Date.now()))
  const growthHours = shallowRef<GrowthHours>(4)
  const seasons = shallowRef<SeasonCount>(1)
  const land = shallowRef<LandType>('normal')
  const actualFirstHarvestInput = shallowRef<string | null>(null)

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
    if (SEASON_COUNTS.some((count) => count === value)) seasons.value = value as SeasonCount
  }

  function updateLand(value: unknown) {
    if (isLandType(value)) land.value = value
  }

  function setCurrentTime() {
    plantedAtInput.value = toBeijingInput(Date.now())
  }

  function reset() {
    plantedAtInput.value = toBeijingInput(Date.now())
    growthHours.value = 4
    seasons.value = 1
    land.value = 'normal'
    actualFirstHarvestInput.value = null
  }

  return {
    landOptions, pickerActions, plantedAtInput, growthHours, seasons, land,
    actualFirstHarvestInput, updatePlantedAt, updateActualHarvest,
    updateGrowthHours, updateSeasons, updateLand, setCurrentTime, reset,
  }
}

function useHarvestResult(inputs: Pick<ReturnType<typeof useHarvestForm>,
  'plantedAtInput' | 'growthHours' | 'seasons' | 'land' | 'actualFirstHarvestInput'>) {
  const view = computed<ViewState>(() => {
    const plantedAt = parseBeijingDateTime(inputs.plantedAtInput.value ?? '')
    if (plantedAt === null) {
      return { schedule: null, plantingError: '请输入有效的播种时间。', actualError: null }
    }

    const baseInput = {
      plantedAt,
      growthHours: inputs.growthHours.value,
      seasons: inputs.seasons.value,
      land: inputs.land.value,
    }
    const baseSchedule = calculateHarvest(baseInput)
    if (inputs.seasons.value === 1 || !inputs.actualFirstHarvestInput.value) {
      return { schedule: baseSchedule, plantingError: null, actualError: null }
    }

    const actualFirstHarvestAt = parseBeijingDateTime(inputs.actualFirstHarvestInput.value)
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
  const actualFirstHarvestAt = computed(() => inputs.actualFirstHarvestInput.value
    ? parseBeijingDateTime(inputs.actualFirstHarvestInput.value)
    : null)

  function seasonFormula(schedule: SeasonSchedule): string {
    return `${formatDuration(schedule.baseDurationSeconds)} × ${(LAND[schedule.land].tenths / 10).toFixed(1)} = ${formatDuration(schedule.durationSeconds)}`
  }

  return { view, first, second, actualFirstHarvestAt, seasonFormula }
}

const {
  landOptions, pickerActions, plantedAtInput, growthHours, seasons, land,
  actualFirstHarvestInput, updatePlantedAt, updateActualHarvest,
  updateGrowthHours, updateSeasons, updateLand, setCurrentTime, reset,
} = useHarvestForm()
const { view, first, second, actualFirstHarvestAt, seasonFormula } = useHarvestResult({
  plantedAtInput, growthHours, seasons, land, actualFirstHarvestInput,
})
</script>

<template>
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
            <NButton @click="setCurrentTime">此刻</NButton>
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
            <NRadioButton v-for="count in SEASON_COUNTS" :key="count" :value="count" :label="count === 1 ? '一季' : '两季'" />
          </NRadioGroup>
        </NFormItem>

        <NFormItem label="土地">
          <NSelect :value="land" :options="landOptions" @update:value="updateLand" />
        </NFormItem>

        <template v-if="seasons === 2">
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

    <section class="results-column" aria-label="计算结论">
      <NCard title="计算结论" class="conclusion-card">
        <template v-if="first">
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
        <NEmpty v-else description="填写播种时间后显示计算结论" />
      </NCard>
    </section>
  </div>
</template>
