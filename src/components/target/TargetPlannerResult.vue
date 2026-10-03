<script setup lang="ts">
import { computed } from 'vue'
import { NCard, NDescriptions, NDescriptionsItem, NEmpty, NTag, NTimeline, NTimelineItem } from 'naive-ui'
import { LAND } from '@/config'
import { formatBeijingMoment, formatDuration } from '@/lib/harvest'
import type { TargetPlanResult } from '@/lib/target-plan'

const props = defineProps<{ result: TargetPlanResult | null }>()

function useTargetPresentation() {
  const windowLabel = computed(() => props.result
    ? `${formatBeijingMoment(props.result.windowStartAt).time}–${formatBeijingMoment(props.result.windowEndAt).time}`
    : '')
  const startedLate = computed(() => props.result && props.result.planningFromAt > props.result.windowStartAt)
  return { windowLabel, startedLate }
}

const { windowLabel, startedLate } = useTargetPresentation()
</script>

<template>
  <section class="target-result" aria-label="目标种植方案">
    <NCard title="目标种植方案" class="planner-result-card">
      <template v-if="result">
        <p class="target-result-context">{{ formatBeijingMoment(result.windowStartAt).date }} · {{ LAND[result.land].label }} · 可操作 {{ windowLabel }}</p>
        <p v-if="startedLate" class="target-result-note">今天从 {{ formatBeijingMoment(result.planningFromAt).time }} 开始安排。</p>
        <div class="target-summary">
          <NDescriptions label-placement="left" :column="1" bordered size="small">
            <NDescriptionsItem label="播种次数">{{ result.crops.length }} 次</NDescriptionsItem>
            <NDescriptionsItem label="全部收菜完成">{{ formatBeijingMoment(result.completedAt).time }}</NDescriptionsItem>
            <NDescriptionsItem label="每块地化肥">{{ formatDuration(result.fertilizerSecondsPerPlot) }}</NDescriptionsItem>
            <NDescriptionsItem label="24 块地化肥合计">{{ formatDuration(result.fertilizerSecondsFor24Plots) }}</NDescriptionsItem>
          </NDescriptions>
        </div>
        <h3 class="target-timeline-title">播种与收菜安排</h3>
        <NTimeline class="target-timeline">
          <NTimelineItem
            v-for="(crop, index) in result.crops" :key="crop.requestIndex"
            :title="`${formatBeijingMoment(crop.plantedAt).time} 播种 · 第 ${index + 1} 次 · ${crop.seedLabel}`"
          >
            <div v-for="harvest in crop.harvests" :key="harvest.season" class="target-harvest-row">
              <span>第{{ harvest.season === 1 ? '一' : '二' }}季收菜</span>
              <strong>{{ formatBeijingMoment(harvest.harvestAt).time }}</strong>
              <NTag v-if="harvest.fertilizerReductionSeconds > 0" type="warning" :bordered="false" size="small">
                每块地施肥缩短 {{ formatDuration(harvest.fertilizerReductionSeconds) }}
              </NTag>
            </div>
          </NTimelineItem>
        </NTimeline>
        <p class="target-result-note">同一时刻可完成收菜并播种下一次。化肥总时长按 24 块地同步使用计算。</p>
      </template>
      <div v-else class="planner-empty-result"><NEmpty description="加入种子后点击生成目标方案" /></div>
    </NCard>
  </section>
</template>

<style scoped>
.target-result { min-width: 0; }
.target-result-context { margin: 0; color: var(--field-muted); font-size: 12px; line-height: 1.6; }
.target-summary { margin-top: 18px; }
.target-timeline-title { margin: 25px 0 17px; color: var(--field-ink); font-size: 15px; }
.target-timeline { margin-top: 8px; }
.target-harvest-row { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; margin: 7px 0; font-size: 12px; }
.target-harvest-row span { color: var(--field-muted); }
.target-harvest-row strong { color: var(--field-ink); }
.target-result-note { margin: 12px 0 0; color: var(--field-muted); font-size: 11px; line-height: 1.6; }
</style>
