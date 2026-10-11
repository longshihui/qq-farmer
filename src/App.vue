<script setup lang="ts">
import { shallowRef } from 'vue'
import { NConfigProvider, NRadioButton, NRadioGroup, dateZhCN, zhCN } from 'naive-ui'
import AppHero from '@/components/AppHero.vue'
import { fieldTheme, navigationTheme } from '@/theme'
import DailyPlannerView from '@/components/DailyPlannerView.vue'
import SingleHarvestView from '@/components/SingleHarvestView.vue'
import TargetPlannerView from '@/components/target/TargetPlannerView.vue'

function useViewSwitch() {
  const activeView = shallowRef<'single' | 'daily' | 'target'>('single')

  function updateActiveView(value: unknown) {
    if (value === 'single' || value === 'daily' || value === 'target') activeView.value = value
  }

  return { activeView, updateActiveView }
}

const { activeView, updateActiveView } = useViewSwitch()
</script>

<template>
  <NConfigProvider :locale="zhCN" :date-locale="dateZhCN" :theme-overrides="fieldTheme">
    <main class="page-shell" :class="{ 'page-shell--planner': activeView === 'daily' || activeView === 'target' }">
      <AppHero />

      <NRadioGroup class="view-switch" aria-label="选择规划工具" :theme-overrides="navigationTheme" :value="activeView" @update:value="updateActiveView">
        <NRadioButton value="single" label="单次计算" />
        <NRadioButton value="daily" label="全天规划" />
        <NRadioButton value="target" label="目标种植" />
      </NRadioGroup>

      <SingleHarvestView v-show="activeView === 'single'" />
      <DailyPlannerView v-show="activeView === 'daily'" />
      <TargetPlannerView v-show="activeView === 'target'" />
    </main>
  </NConfigProvider>
</template>
