<script setup lang="ts">
import { computed } from 'vue'
import { NCard, NEmpty, NStatistic, NTag, NTimeline, NTimelineItem } from 'naive-ui'
import { HARVEST_COUNT_PREFERENCES, LAND } from '@/config'
import type { DailyPlanResult } from '@/lib/daily-plan'
import { formatBeijingMoment, toBeijingInput } from '@/lib/harvest'

const props = defineProps<{ result: DailyPlanResult | null }>()

function usePlanPresentation() {
  const combination = computed(() => {
    const counts = new Map<string, { id: string; label: string; count: number }>()
    for (const crop of props.result?.crops ?? []) {
      const item = counts.get(crop.seedId)
      if (item) item.count++
      else counts.set(crop.seedId, { id: crop.seedId, label: crop.seedLabel, count: 1 })
    }
    return [...counts.values()]
  })
  const resultPreferenceLabel = computed(() =>
    HARVEST_COUNT_PREFERENCES.find((option) => option.value === props.result?.harvestCountPreference)?.label ?? '')

  function momentAt(timestamp: number): string {
    const moment = formatBeijingMoment(timestamp)
    const date = toBeijingInput(timestamp).slice(0, 10)
    return date === props.result?.date ? moment.time : `${date.slice(5)} ${moment.time}`
  }

  return { combination, resultPreferenceLabel, momentAt }
}

const { combination, resultPreferenceLabel, momentAt } = usePlanPresentation()
</script>

<template>
  <section class="planner-result-column" aria-label="全天规划结果">
    <NCard title="推荐方案" class="planner-result-card">
      <template v-if="result && result.crops.length > 0">
        <p class="planner-result-date">{{ formatBeijingMoment(result.cycleStartAt).date }} · {{ LAND[result.land].label }} · {{ resultPreferenceLabel }}</p>
        <p class="planner-cycle-range">日循环 {{ momentAt(result.cycleStartAt) }} — {{ momentAt(result.cycleEndAt) }}<span v-if="result.planningFromAt > result.cycleStartAt"> · 本次从 {{ momentAt(result.planningFromAt) }} 继续</span></p>
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
            :title="`${momentAt(crop.plantedAt)} 播种 · ${crop.seedLabel}`"
          >
            <div v-for="harvest in crop.harvests" :key="harvest.season" class="season-row">
              <span>第{{ harvest.season === 1 ? '一' : '二' }}季</span>
              <strong><time :datetime="new Date(harvest.harvestAt).toISOString()">{{ momentAt(harvest.harvestAt) }}</time> 收菜</strong>
              <NTag type="success" :bordered="false" size="small">经验权重 +{{ harvest.experienceWeight }}</NTag>
            </div>
          </NTimelineItem>
        </NTimeline>
        <p class="planner-result-note">{{ momentAt(result.generatedAt) }} 生成</p>
      </template>
      <div v-else-if="result" class="planner-empty-result">
        <p class="planner-cycle-range">日循环 {{ momentAt(result.cycleStartAt) }} — {{ momentAt(result.cycleEndAt) }}</p>
        <NEmpty description="当前条件下没有可行的种植方案" />
      </div>
      <div v-else class="planner-empty-result">
        <NEmpty description="点击生成方案" />
      </div>
    </NCard>
  </section>
</template>
