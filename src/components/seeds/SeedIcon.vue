<script setup lang="ts">
import type { SeedIconVariant } from '@/composables/useSeedCardPresentation'

defineProps<{ variant: SeedIconVariant }>()
</script>

<template>
  <svg class="seed-icon" viewBox="0 0 64 72" aria-hidden="true" focusable="false">
    <g v-if="variant === 'round'">
      <path class="seed-icon__shell" d="M32 15c13-1 23 9 23 23S45 61 32 60C18 61 9 51 9 38S19 14 32 15Z" />
      <path class="seed-icon__seam" d="M33 18c-8 10-10 26-2 38" />
      <path class="seed-icon__etch" d="m19 24-3 5m4 4-3 5m27-13 3 5m-3 15-2 5m-23-4 3 5" />
      <path class="seed-icon__light" d="M38 21c5 1 9 5 10 10" />
    </g>
    <g v-else-if="variant === 'oval'" transform="rotate(22 32 36)">
      <path class="seed-icon__shell" d="M32 7c12 0 19 14 19 29S43 65 32 65 13 51 13 36 20 7 32 7Z" />
      <path class="seed-icon__seam" d="M32 11c-6 15-6 33 0 50" />
      <path class="seed-icon__etch" d="m22 21-2 7m2 6-2 8m21-19 2 7m-2 16-2 7" />
      <path class="seed-icon__light" d="M37 15c5 5 7 11 8 18" />
    </g>
    <g v-else-if="variant === 'teardrop'">
      <path class="seed-icon__shell" d="M33 5c2 12 21 22 21 37 0 13-9 23-22 23S10 56 10 43C10 27 26 17 33 5Z" />
      <path class="seed-icon__seam" d="M32 15c-5 13-10 30-1 45" />
      <path class="seed-icon__etch" d="m22 32-3 6m2 5-2 7m25-17 3 7m-4 12-3 5" />
      <path class="seed-icon__light" d="M37 25c5 5 10 10 11 17" />
    </g>
    <g v-else>
      <g transform="rotate(-24 22 39)">
        <path class="seed-icon__shell" d="M22 16c9 0 14 11 14 23S30 62 22 62 8 51 8 39s5-23 14-23Z" />
        <path class="seed-icon__seam" d="M22 20c-4 12-4 25 0 38" />
        <path class="seed-icon__etch" d="m15 29-1 6m14 9-1 6" />
      </g>
      <g transform="rotate(25 43 32)">
        <path class="seed-icon__shell seed-icon__shell--front" d="M43 8c9 0 14 11 14 24S51 56 43 56 29 45 29 32 34 8 43 8Z" />
        <path class="seed-icon__seam" d="M43 12c-4 12-4 26 0 40" />
        <path class="seed-icon__etch" d="m36 23-1 6m14 11-1 7" />
        <path class="seed-icon__light" d="M47 15c3 4 5 9 5 14" />
      </g>
    </g>
  </svg>
</template>

<style scoped>
.seed-icon { display: block; width: 100%; height: auto; overflow: visible; pointer-events: none; }
.seed-icon__shell { fill: #e6cda5; stroke: #44664d; stroke-width: 1.8; stroke-linejoin: round; }
.seed-icon__shell--front { fill: #ead5b4; }
.seed-icon__seam { fill: none; stroke: #587755; stroke-width: 1.7; stroke-linecap: round; }
.seed-icon__etch { fill: none; stroke: #b08c5d; stroke-width: 1.1; stroke-linecap: round; }
.seed-icon__light { fill: none; stroke: #faf5e8; stroke-width: 2.5; stroke-linecap: round; }
</style>
