<script setup lang="ts">
import { shallowRef } from 'vue'
import { NConfigProvider, NRadioButton, NRadioGroup, dateZhCN, zhCN } from 'naive-ui'
import DailyPlannerView from '@/components/DailyPlannerView.vue'
import SingleHarvestView from '@/components/SingleHarvestView.vue'

function useViewSwitch() {
  const activeView = shallowRef<'single' | 'daily'>('single')

  function updateActiveView(value: unknown) {
    if (value === 'single' || value === 'daily') activeView.value = value
  }

  return { activeView, updateActiveView }
}

const { activeView, updateActiveView } = useViewSwitch()
</script>

<template>
  <NConfigProvider :locale="zhCN" :date-locale="dateZhCN">
    <main class="page-shell" :class="{ 'page-shell--planner': activeView === 'daily' }">
      <header class="page-header">
        <h1>田间时刻</h1>
        <p>收菜时间计算与全天规划 · 北京时间</p>
      </header>

      <NRadioGroup class="view-switch" :value="activeView" @update:value="updateActiveView">
        <NRadioButton value="single" label="单次计算" />
        <NRadioButton value="daily" label="全天规划" />
      </NRadioGroup>

      <SingleHarvestView v-show="activeView === 'single'" />
      <DailyPlannerView v-show="activeView === 'daily'" />
    </main>
  </NConfigProvider>
</template>
