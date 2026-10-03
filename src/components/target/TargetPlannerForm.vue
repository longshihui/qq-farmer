<script setup lang="ts">
import { NCard, NDatePicker, NForm, NFormItem, NRadioButton, NRadioGroup, NSelect, NTimePicker } from 'naive-ui'
import type { LandType } from '@/config'

defineProps<{
  date: string
  windowStartTime: string
  windowEndTime: string
  land: LandType
  landOptions: { value: LandType; label: string }[]
  useFertilizer: boolean
  isDateDisabled: (timestamp: number) => boolean
}>()

const emit = defineEmits<{
  updateDate: [value: string | [string, string] | null]
  updateWindowStartTime: [value: string | null]
  updateWindowEndTime: [value: string | null]
  updateLand: [value: unknown]
  updateUseFertilizer: [value: unknown]
}>()
</script>

<template>
  <NCard title="种植条件" class="planner-form-card target-card">
    <NForm label-placement="top" :show-feedback="false" class="target-form">
      <NFormItem label="日期（北京时间）">
        <NDatePicker
          type="date" format="yyyy-MM-dd" value-format="yyyy-MM-dd"
          :formatted-value="date" :is-date-disabled="isDateDisabled"
          @update:formatted-value="emit('updateDate', $event)"
        />
      </NFormItem>
      <div class="target-time-fields">
        <NFormItem label="可操作开始">
          <NTimePicker
            format="HH:mm" value-format="HH:mm" :formatted-value="windowStartTime"
            @update:formatted-value="emit('updateWindowStartTime', $event)"
          />
        </NFormItem>
        <NFormItem label="可操作结束">
          <NTimePicker
            format="HH:mm" value-format="HH:mm" :formatted-value="windowEndTime"
            @update:formatted-value="emit('updateWindowEndTime', $event)"
          />
        </NFormItem>
      </div>
      <NFormItem label="土地">
        <NSelect :value="land" :options="landOptions" @update:value="emit('updateLand', $event)" />
      </NFormItem>
      <NFormItem label="使用化肥">
        <NRadioGroup class="choice-group" :value="useFertilizer" @update:value="emit('updateUseFertilizer', $event)">
          <NRadioButton :value="false" label="否" />
          <NRadioButton :value="true" label="是" />
        </NRadioGroup>
      </NFormItem>
    </NForm>
    <p class="target-hint">播种与每季收菜都安排在当天时段内。24 块地同步执行；允许化肥时仅计算满足目标所需的最少用量。</p>
  </NCard>
</template>

<style scoped>
.target-form { display: grid; gap: 16px; }
.target-form :deep(.n-form-item) { min-width: 0; margin: 0; }
.target-form :deep(.n-date-picker), .target-form :deep(.n-select), .target-form :deep(.n-time-picker) { width: 100%; }
.target-time-fields { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
.target-hint { margin: 16px 0 0; color: var(--field-muted); font-size: 12px; line-height: 1.6; }
@media (max-width: 520px) { .target-time-fields { grid-template-columns: 1fr; } }
</style>
