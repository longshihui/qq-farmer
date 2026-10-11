<script setup lang="ts">
import heroArtwork from '@/assets/hero-watercolor.png'
</script>

<template>
  <header class="app-hero">
    <img
      class="app-hero__art" :src="heroArtwork" alt="" aria-hidden="true"
      width="2170" height="725" fetchpriority="high" decoding="async"
    />
    <div class="app-hero__copy">
      <p class="app-hero__eyebrow"><span aria-hidden="true" />耕种有时 · 收获有期</p>
      <h1 class="app-hero__title">田间时刻</h1>
      <p class="app-hero__description">收菜时间计算、全天规划与目标种植</p>
      <p class="app-hero__timezone">
        <svg aria-hidden="true" viewBox="0 0 16 16" fill="none">
          <circle cx="8" cy="8" r="5.5" />
          <path d="M8 4.5V8l2.5 1.5" />
        </svg>
        北京时间<span class="app-hero__utc">UTC+8</span>
      </p>
    </div>
  </header>
</template>

<style scoped>
.app-hero {
  position: relative;
  isolation: isolate;
  min-height: 260px;
  margin-bottom: 16px;
  overflow: hidden;
}
.app-hero__art {
  position: absolute;
  z-index: -1;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center 18%;
  mix-blend-mode: multiply;
  mask-image: linear-gradient(to right, transparent 25%, #000 53% 94%, transparent),
    linear-gradient(to bottom, transparent, #000 12% 86%, transparent);
  mask-composite: intersect;
  pointer-events: none;
}
.app-hero__copy { position: relative; width: fit-content; max-width: 100%; padding: 29px 0 28px 4px; }
.app-hero__eyebrow {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 0 0 14px;
  color: var(--field-muted);
  font-size: 11px;
  letter-spacing: .18em;
}
.app-hero__eyebrow span { width: 24px; height: 1px; background: #a4b093; }
.app-hero__title {
  margin: 0;
  color: var(--field-ink);
  font-family: "Songti SC", "STSong", "SimSun", serif;
  font-size: 60px;
  font-weight: 500;
  line-height: 1.2;
  letter-spacing: .13em;
}
.app-hero__description { margin: 18px 0 0; color: #5c6d5c; font-size: 14px; line-height: 1.7; }
.app-hero__timezone { display: flex; align-items: center; gap: 7px; margin: 18px 0 0; color: var(--field-muted); font-size: 11px; }
.app-hero__timezone svg { width: 14px; height: 14px; stroke: currentColor; stroke-width: 1.2; stroke-linecap: round; stroke-linejoin: round; }
.app-hero__utc { margin-left: 2px; padding-left: 9px; border-left: 1px solid #cbd3c2; font-variant-numeric: tabular-nums; letter-spacing: .04em; }
@media (max-width: 1199px) {
  .app-hero__art { width: 115%; left: -15%; }
}
@media (max-width: 767px) {
  .app-hero { min-height: 230px; }
  .app-hero__copy { padding-top: 24px; }
  .app-hero__title { font-size: 40px; letter-spacing: .12em; }
  .app-hero__description { max-width: 250px; margin-top: 14px; font-size: 13px; }
  .app-hero__eyebrow { margin-bottom: 15px; font-size: 10px; }
  .app-hero__art {
    inset: auto 0 0 auto;
    width: 100%;
    height: 145px;
    object-position: right 70%;
    opacity: .62;
    mask-image: linear-gradient(to right, transparent 23%, #000 88%),
      linear-gradient(to bottom, transparent, #000 50% 85%, transparent);
  }
  .app-hero__timezone { margin-top: 17px; }
}
</style>
