<script setup lang="ts">
import { NButton, NCheckbox } from 'naive-ui'
import SeedIcon from './SeedIcon.vue'
import seedBackground from '@/assets/hero-watercolor.png'
import { useSeedCardPresentation, type SeedCardSeed } from '@/composables/useSeedCardPresentation'
import { useSeedCardInteractions } from '@/composables/useSeedCardInteractions'

const props = withDefaults(defineProps<{
  seed: SeedCardSeed
  mode: 'select' | 'quantity'
  selected?: boolean
  count?: number
  experienceWeights?: readonly number[]
}>(), {
  selected: false,
  count: 0,
  experienceWeights: () => [],
})

const emit = defineEmits<{
  'update:selected': [selected: boolean]
  add: [id: string]
  remove: [id: string]
  delete: [id: string]
}>()

const {
  isEvent, seasonLabel, iconVariant, weightLabel, seedLabel, cardClasses, selectionAttributes, decreaseButtonTheme,
} = useSeedCardPresentation(props)
const { updateSelected, addSeed, removeSeed, deleteSeed } = useSeedCardInteractions(props, {
  updateSelected: (selected) => emit('update:selected', selected),
  add: (id) => emit('add', id),
  remove: (id) => emit('remove', id),
  delete: (id) => emit('delete', id),
})
</script>

<template>
  <div class="seed-packet" :class="cardClasses">
    <span class="seed-packet__background" aria-hidden="true">
      <img class="seed-packet__background-image" :src="seedBackground" alt="" :draggable="false" decoding="async" />
    </span>
    <component
      :is="mode === 'select' ? NCheckbox : 'div'"
      v-bind="selectionAttributes"
      class="seed-packet__main"
      @update:checked="updateSelected"
    >
      <span class="seed-packet__layout">
        <span class="seed-packet__icon" aria-hidden="true">
          <SeedIcon :variant="iconVariant" />
        </span>
        <span class="seed-packet__content">
          <span class="seed-packet__top">
            <span class="seed-packet__duration">
              <strong class="seed-packet__hours">{{ seed.growthHours }}</strong>
              <span class="seed-packet__unit">小时</span>
            </span>
            <span class="seed-packet__season">{{ seasonLabel }}</span>
          </span>
          <span v-if="isEvent || seed.custom" class="seed-packet__badges">
            <span v-if="isEvent" class="seed-packet__event">活动</span>
            <span v-if="seed.custom" class="seed-packet__custom">自定义</span>
          </span>
          <span v-if="weightLabel" class="seed-packet__experience">
            <span class="seed-packet__experience-label">经验权重</span>
            <strong class="seed-packet__weight">{{ weightLabel }}</strong>
          </span>
        </span>
      </span>
    </component>

    <div v-if="mode === 'quantity'" class="seed-packet__actions">
      <NButton
        class="seed-packet__decrease" size="small" :disabled="count === 0"
        :theme-overrides="decreaseButtonTheme"
        :aria-label="`减少${seedLabel}`" @click="removeSeed"
      >−</NButton>
      <span class="seed-packet__count" :aria-label="`已加入 ${count} 次播种`">× {{ count }}</span>
      <NButton
        class="seed-packet__add" size="small" type="primary"
        :aria-label="`加入${seedLabel}`" @click="addSeed"
      >加入</NButton>
    </div>
    <div v-if="seed.custom" class="seed-packet__delete-row">
      <NButton
        class="seed-packet__delete" text size="small"
        :aria-label="`删除${seedLabel}`" @click="deleteSeed"
      >删除</NButton>
    </div>
  </div>
</template>

<style scoped>
.seed-packet {
  --seed-wash: #eaf0e2;
  --seed-divider: #dfe4d6;
  --seed-selection-ring: inset 0 0 0 0 transparent;
  position: relative;
  isolation: isolate;
  container: seed-packet / inline-size;
  display: flex;
  min-width: 0;
  height: 100%;
  flex-direction: column;
  border: 1px solid #dce2d2;
  border-radius: 10px;
  background: linear-gradient(120deg, #faf9f3, var(--field-paper) 58%, var(--seed-wash));
  box-shadow: var(--seed-selection-ring), 0 2px 5px rgb(48 57 35 / 3%);
  transition: transform 160ms ease, border-color 160ms ease, box-shadow 160ms ease;
}
.seed-packet--event { --seed-wash: #f3e8d4; --seed-divider: #e6dfcf; }
.seed-packet--selected {
  --seed-selection-ring: inset 0 0 0 1px var(--field-green);
  border-color: var(--field-green);
}
.seed-packet:hover { transform: translateY(-1px); box-shadow: var(--seed-selection-ring), 0 4px 10px rgb(42 61 38 / 7%); }
.seed-packet:not(.seed-packet--selected):hover { border-color: #a6b99c; }
.seed-packet:has(:focus-visible) { outline: 2px solid var(--field-green); outline-offset: 3px; }
.seed-packet__background { position: absolute; z-index: 0; inset: 0; overflow: hidden; border-radius: inherit; opacity: .12; pointer-events: none; }
.seed-packet__background-image { display: block; width: 100%; height: 100%; object-fit: cover; object-position: right bottom; }
.seed-packet__main { position: relative; z-index: 1; display: block; width: 100%; min-width: 0; min-height: 104px; flex: 1; padding: 12px; }
.seed-packet__main.n-checkbox { margin: 0; }
.seed-packet__main.n-checkbox:focus-visible { outline: none; }
.seed-packet__main :deep(.n-checkbox__label) { display: block; width: 100%; min-width: 0; padding: 0; white-space: normal; }
.seed-packet__main :deep(.n-checkbox-box-wrapper) { display: none; }
.seed-packet__layout { display: grid; grid-template-columns: 44px minmax(0, 1fr); align-items: center; gap: 10px; }
.seed-packet__icon { display: block; width: 44px; pointer-events: none; }
.seed-packet__content { display: block; min-width: 0; }
.seed-packet__top { display: flex; align-items: baseline; justify-content: space-between; gap: 4px; }
.seed-packet__duration { display: inline-flex; align-items: baseline; gap: 2px; white-space: nowrap; }
.seed-packet__hours { color: #294d3b; font-family: Georgia, 'Songti SC', serif; font-size: 30px; font-weight: 400; font-variant-numeric: tabular-nums; letter-spacing: -.04em; line-height: 1.1; }
.seed-packet__unit { color: #52624b; font-size: 11px; line-height: 1.4; }
.seed-packet__season { color: #465d42; font-size: 12px; line-height: 1.5; white-space: nowrap; }
.seed-packet__badges { display: flex; align-items: center; flex-wrap: wrap; gap: 4px; margin-top: 4px; }
.seed-packet__event, .seed-packet__custom { padding: 0 3px; border: 1px solid; border-radius: 2px; font-size: 10px; line-height: 14px; white-space: nowrap; }
.seed-packet__event { color: #9d452e; border-color: #d4ab95; }
.seed-packet__custom { color: #68705d; border-color: #ced1c0; }
.seed-packet__experience { display: flex; min-width: 0; flex-direction: column; gap: 2px; margin-top: 7px; }
.seed-packet__experience-label { color: #52624b; font-size: 12px; line-height: 1.4; }
.seed-packet__weight { min-width: 0; color: var(--field-ink); font-size: 14px; font-weight: 600; font-variant-numeric: tabular-nums; line-height: 1.4; overflow-wrap: anywhere; }
.seed-packet__actions { position: relative; z-index: 1; display: flex; align-items: center; flex-wrap: wrap; gap: 6px; margin: 0 10px; padding: 7px 0; border-top: 1px solid var(--seed-divider); }
.seed-packet__decrease { width: 28px; padding: 0; flex: none; }
.seed-packet__count { min-width: 25px; flex: 1; color: var(--field-green); font-size: 14px; font-weight: 700; font-variant-numeric: tabular-nums; text-align: center; overflow-wrap: anywhere; }
.seed-packet__add { padding-right: 9px; padding-left: 9px; }
.seed-packet__delete-row { position: relative; z-index: 1; display: flex; justify-content: flex-end; padding: 0 10px 8px; }
.seed-packet__delete { color: #9d452e; }
@container seed-packet (max-width: 170px) {
  .seed-packet__main { padding: 10px; }
  .seed-packet__layout { grid-template-columns: 36px minmax(0, 1fr); gap: 8px; }
  .seed-packet__icon { width: 36px; }
  .seed-packet__hours { font-size: 26px; }
  .seed-packet__season { font-size: 11px; }
}
@media (prefers-reduced-motion: reduce) {
  .seed-packet { transition: none; }
  .seed-packet:hover { transform: none; }
}
</style>
