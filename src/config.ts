/** 土地配置：缩短生长时间的比例及计算时使用的十分位系数。 */
export const LAND = {
  normal: { label: '普通土地', reduction: 0, tenths: 10 },
  black: { label: '黑土地', reduction: 10, tenths: 9 },
  gold: { label: '金土地', reduction: 20, tenths: 8 },
} as const

/** 全天规划的种子分组及其显示顺序。 */
export const SEED_GROUPS = [
  { id: 'one-season', label: '一季种子', customSeason: null },
  { id: 'two-season', label: '两季种子', customSeason: null },
  { id: 'event-one', label: '活动种子 · 一季', customSeason: 1 },
  { id: 'event-two', label: '活动种子 · 两季', customSeason: 2 },
] as const

export type SeedGroupId = (typeof SEED_GROUPS)[number]['id']

type SeedRule = {
  id: string
  group: SeedGroupId
  growthHours: number
  label: string
} & (
  | { seasons: 1; experienceWeightBySeason: readonly [number] }
  | { seasons: 2; experienceWeightBySeason: readonly [number, number] }
)

/** 种子配置：各品类的首季时长、季数及每季经验权重，供两个视图共用。 */
export const SEED_TYPES = [
  { id: 'one-4', group: 'one-season', label: '4 小时 · 一季', growthHours: 4, seasons: 1, experienceWeightBySeason: [4] },
  { id: 'one-8', group: 'one-season', label: '8 小时 · 一季', growthHours: 8, seasons: 1, experienceWeightBySeason: [8] },
  { id: 'one-12', group: 'one-season', label: '12 小时 · 一季', growthHours: 12, seasons: 1, experienceWeightBySeason: [12] },
  { id: 'one-24', group: 'one-season', label: '24 小时 · 一季', growthHours: 24, seasons: 1, experienceWeightBySeason: [24] },
  { id: 'two-4', group: 'two-season', label: '4 小时 · 两季', growthHours: 4, seasons: 2, experienceWeightBySeason: [4, 2] },
  { id: 'two-8', group: 'two-season', label: '8 小时 · 两季', growthHours: 8, seasons: 2, experienceWeightBySeason: [8, 4] },
  { id: 'two-12', group: 'two-season', label: '12 小时 · 两季', growthHours: 12, seasons: 2, experienceWeightBySeason: [12, 6] },
  { id: 'two-24', group: 'two-season', label: '24 小时 · 两季', growthHours: 24, seasons: 2, experienceWeightBySeason: [24, 12] },
  { id: 'event-12', group: 'event-one', label: '12 小时 · 活动 · 一季', growthHours: 12, seasons: 1, experienceWeightBySeason: [24] },
] as const satisfies readonly SeedRule[]

/** 全天规划在最高经验权重方案中的收菜次数偏好。 */
export const HARVEST_COUNT_PREFERENCES = [
  { value: 'fewer', label: '次数最少' },
  { value: 'middle', label: '平衡' },
  { value: 'more', label: '次数最多' },
] as const

export type LandType = keyof typeof LAND
export type SeedType = (typeof SEED_TYPES)[number]
export type SeedId = SeedType['id']
export type GrowthHours = SeedType['growthHours']
export type SeasonCount = SeedType['seasons']
export type HarvestCountPreference = (typeof HARVEST_COUNT_PREFERENCES)[number]['value']

/** 默认在最高经验权重相同的方案中选择收菜次数最多的。 */
export const DEFAULT_HARVEST_COUNT_PREFERENCE: HarvestCountPreference = 'more'

/** 单次计算视图可选的首季生长时长，由种子配置生成。 */
export const GROWTH_HOURS: GrowthHours[] = [...new Set(SEED_TYPES.map((seed) => seed.growthHours))]

/** 单次计算视图可选的收获季数，由种子配置生成。 */
export const SEASON_COUNTS: SeasonCount[] = [...new Set(SEED_TYPES.map((seed) => seed.seasons))]

export function isLandType(value: unknown): value is LandType {
  return typeof value === 'string' && Object.hasOwn(LAND, value)
}

export function isSeedId(value: unknown): value is SeedId {
  return typeof value === 'string' && SEED_TYPES.some((seed) => seed.id === value)
}

export function isHarvestCountPreference(value: unknown): value is HarvestCountPreference {
  return typeof value === 'string' && HARVEST_COUNT_PREFERENCES.some((preference) => preference.value === value)
}
