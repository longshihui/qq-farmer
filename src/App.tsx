import { useEffect, useMemo, useState } from 'react'
import {
  ArrowRight,
  CalendarDays,
  Check,
  Clock3,
  Leaf,
  RotateCcw,
  Sprout,
  Sun,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  calculateHarvest,
  formatBeijingMoment,
  formatCountdown,
  formatDuration,
  GROWTH_HOURS,
  LAND,
  parseBeijingDateTime,
  toBeijingInput,
  type GrowthHours,
  type HarvestSchedule,
  type LandType,
  type SeasonCount,
  type SeasonSchedule,
} from '@/lib/harvest'

const landNotes: Record<LandType, string> = {
  normal: '不缩短',
  black: '缩短 10%',
  gold: '缩短 20%',
}

const landFactors: Record<LandType, string> = {
  normal: '1.0',
  black: '0.9',
  gold: '0.8',
}

interface ViewState {
  schedule: HarvestSchedule | null
  plantingError: string | null
  actualError: string | null
}

function getViewState(
  plantedAtInput: string,
  growthHours: GrowthHours,
  seasons: SeasonCount,
  firstLand: LandType,
  secondLand: LandType,
  actualFirstHarvestInput: string,
): ViewState {
  const plantedAt = parseBeijingDateTime(plantedAtInput)
  if (plantedAt === null) {
    return { schedule: null, plantingError: '请输入有效的播种时间。', actualError: null }
  }

  const baseInput = { plantedAt, growthHours, seasons, firstLand, secondLand }
  const baseSchedule = calculateHarvest(baseInput)
  if (seasons === 1 || !actualFirstHarvestInput) {
    return { schedule: baseSchedule, plantingError: null, actualError: null }
  }

  const actualFirstHarvestAt = parseBeijingDateTime(actualFirstHarvestInput)
  if (actualFirstHarvestAt === null) {
    return {
      schedule: baseSchedule,
      plantingError: null,
      actualError: '请输入有效的第一次实际收菜时间。',
    }
  }
  if (actualFirstHarvestAt < baseSchedule.first.readyAt) {
    return {
      schedule: baseSchedule,
      plantingError: null,
      actualError: '实际收菜时间不能早于第一季成熟时间。',
    }
  }

  return {
    schedule: calculateHarvest({ ...baseInput, actualFirstHarvestAt }),
    plantingError: null,
    actualError: null,
  }
}

function LandSelect({
  id,
  label,
  value,
  onChange,
}: {
  id: string
  label: string
  value: LandType
  onChange: (value: LandType) => void
}) {
  return (
    <Select value={value} onValueChange={(next) => onChange(next as LandType)}>
      <SelectTrigger id={id} className="land-select" aria-label={label}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {(Object.keys(LAND) as LandType[]).map((land) => (
          <SelectItem key={land} value={land}>
            {LAND[land].label} · {landNotes[land]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

function ScheduleTime({ timestamp }: { timestamp: number }) {
  const moment = formatBeijingMoment(timestamp)
  return <time dateTime={new Date(timestamp).toISOString()}>{moment.full}</time>
}

function CalculationLine({ schedule }: { schedule: SeasonSchedule }) {
  return (
    <div className="calculation-line">
      <div className="calculation-label">
        <span className={`land-dot land-dot--${schedule.land}`} aria-hidden="true" />
        第{schedule.season === 1 ? '一' : '二'}季 · {LAND[schedule.land].label}
      </div>
      <div className="calculation-formula">
        {formatDuration(schedule.baseDurationSeconds)}
        <span className="formula-operator">×</span>
        {landFactors[schedule.land]}
        <span className="formula-operator">=</span>
        <strong>{formatDuration(schedule.durationSeconds)}</strong>
      </div>
    </div>
  )
}

function App() {
  const [now, setNow] = useState(() => Date.now())
  const [plantedAtInput, setPlantedAtInput] = useState(() => toBeijingInput(Date.now()))
  const [growthHours, setGrowthHours] = useState<GrowthHours>(4)
  const [seasons, setSeasons] = useState<SeasonCount>(1)
  const [firstLand, setFirstLand] = useState<LandType>('normal')
  const [secondLand, setSecondLand] = useState<LandType>('normal')
  const [actualFirstHarvestInput, setActualFirstHarvestInput] = useState('')

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  const view = useMemo(
    () => getViewState(
      plantedAtInput,
      growthHours,
      seasons,
      firstLand,
      secondLand,
      actualFirstHarvestInput,
    ),
    [plantedAtInput, growthHours, seasons, firstLand, secondLand, actualFirstHarvestInput],
  )

  const first = view.schedule?.first
  const second = view.actualError ? undefined : view.schedule?.second
  const currentMoment = formatBeijingMoment(now)
  const firstMoment = first ? formatBeijingMoment(first.readyAt) : null
  const secondMoment = second ? formatBeijingMoment(second.readyAt) : null
  const actualFirstHarvestAt = actualFirstHarvestInput
    ? parseBeijingDateTime(actualFirstHarvestInput)
    : null

  function useCurrentTime() {
    const timestamp = Date.now()
    setNow(timestamp)
    setPlantedAtInput(toBeijingInput(timestamp))
  }

  function reset() {
    const timestamp = Date.now()
    setNow(timestamp)
    setPlantedAtInput(toBeijingInput(timestamp))
    setGrowthHours(4)
    setSeasons(1)
    setFirstLand('normal')
    setSecondLand('normal')
    setActualFirstHarvestInput('')
  }

  return (
    <div className="app-shell">
      <header className="site-header">
        <div className="brand" aria-label="田间时刻">
          <span className="brand-mark"><Sprout size={23} strokeWidth={2.1} /></span>
          <span className="brand-wordmark">田间时刻<span className="brand-period">.</span></span>
        </div>
        <div className="header-time">
          <span className="live-dot" aria-hidden="true" />
          <span>北京时间</span>
          <strong>{currentMoment.time}</strong>
        </div>
      </header>

      <main className="page-content">
        <section className="hero-banner" aria-labelledby="page-title">
          <div className="hero-copy">
            <div className="hero-eyebrow"><span /> QQ FARM · HARVEST CALCULATOR</div>
            <h1 id="page-title">每一份等待，<br /><em>都有收获的时间。</em></h1>
            <p>选好作物生长时间和土地类型，播种的那一刻，就知道什么时候该回来收菜。</p>
            <div className="hero-caption"><Sun size={16} /> 所有时间均按北京时间计算</div>
          </div>
          <div className="hero-art" aria-hidden="true">
            <div className="hero-sun" />
            <div className="hero-cloud hero-cloud--one" />
            <div className="hero-cloud hero-cloud--two" />
            <div className="field-plot field-plot--back" />
            <div className="field-plot field-plot--front">
              <span><Sprout /></span><span><Sprout /></span><span><Sprout /></span>
            </div>
            <div className="art-stamp">GROW<br />& GATHER</div>
          </div>
        </section>

        <div className="workspace-grid">
          <Card className="panel controls-panel">
            <div className="panel-heading">
              <div>
                <div className="section-kicker">01 / 设置条件</div>
                <h2>你的种植计划</h2>
                <p>调整下方条件，收菜时间会即时更新。</p>
              </div>
              <span className="heading-icon"><Leaf size={22} /></span>
            </div>

            <div className="form-section">
              <div className="field-heading">
                <Label htmlFor="planted-at">播种时间</Label>
                <span>北京时间 · 精确到秒</span>
              </div>
              <div className="datetime-row">
                <Input
                  id="planted-at"
                  type="datetime-local"
                  step="1"
                  value={plantedAtInput}
                  onChange={(event) => setPlantedAtInput(event.target.value)}
                  className="datetime-input"
                  aria-invalid={Boolean(view.plantingError)}
                  aria-describedby={view.plantingError ? 'planting-error' : undefined}
                />
                <Button type="button" variant="outline" className="now-button" onClick={useCurrentTime}>
                  <Clock3 size={16} /> 此刻
                </Button>
              </div>
              {view.plantingError && <p id="planting-error" className="field-error" role="alert">{view.plantingError}</p>}
            </div>

            <div className="form-section">
              <div className="field-heading"><Label id="growth-label">作物生长时间</Label><span>选择一个档位</span></div>
              <div className="choice-grid growth-grid" role="group" aria-labelledby="growth-label">
                {GROWTH_HOURS.map((hours) => (
                  <Button
                    key={hours}
                    type="button"
                    variant="outline"
                    className="choice-button growth-choice"
                    data-selected={growthHours === hours}
                    aria-pressed={growthHours === hours}
                    onClick={() => setGrowthHours(hours)}
                  >
                    <strong>{hours}</strong><span>小时</span>
                  </Button>
                ))}
              </div>
            </div>

            <div className="form-section">
              <div className="field-heading"><Label id="season-label">收获季数</Label><span>决定收菜次数</span></div>
              <div className="choice-grid season-grid" role="group" aria-labelledby="season-label">
                {([1, 2] as const).map((count) => (
                  <Button
                    key={count}
                    type="button"
                    variant="outline"
                    className="choice-button season-choice"
                    data-selected={seasons === count}
                    aria-pressed={seasons === count}
                    onClick={() => setSeasons(count)}
                  >
                    <span className="season-icon"><Sprout size={17} /></span>
                    <span><strong>{count === 1 ? '一季作物' : '两季作物'}</strong><small>可收 {count} 次</small></span>
                    {seasons === count && <Check className="choice-check" size={16} />}
                  </Button>
                ))}
              </div>
            </div>

            <Separator className="form-separator" />

            <div className="land-section">
              <div className="land-section-heading"><span className="step-badge">01</span><div><h3>第一季土地</h3><p>以完整生长时间计算</p></div></div>
              <div className="field-heading"><Label htmlFor="first-land">土地类型</Label><span>{landNotes[firstLand]}</span></div>
              <LandSelect id="first-land" label="第一季土地类型" value={firstLand} onChange={setFirstLand} />
              {first && <div className="duration-note"><Clock3 size={15} /> 实际生长 <strong>{formatDuration(first.durationSeconds)}</strong></div>}
            </div>

            {seasons === 2 && (
              <>
                <Separator className="form-separator" />
                <div className="land-section">
                  <div className="land-section-heading"><span className="step-badge step-badge--second">02</span><div><h3>第二季土地</h3><p>生长时间为原档位的一半</p></div></div>
                  <div className="field-heading"><Label htmlFor="second-land">土地类型</Label><span>{landNotes[secondLand]}</span></div>
                  <LandSelect id="second-land" label="第二季土地类型" value={secondLand} onChange={setSecondLand} />
                  {view.schedule?.second && <div className="duration-note"><Clock3 size={15} /> 实际生长 <strong>{formatDuration(view.schedule.second.durationSeconds)}</strong></div>}

                  <div className="actual-field">
                    <div className="field-heading"><Label htmlFor="actual-harvest">第一次实际收菜时间</Label><span>可选</span></div>
                    <Input
                      id="actual-harvest"
                      type="datetime-local"
                      step="1"
                      value={actualFirstHarvestInput}
                      onChange={(event) => setActualFirstHarvestInput(event.target.value)}
                      className="datetime-input"
                      aria-invalid={Boolean(view.actualError)}
                      aria-describedby={view.actualError ? 'actual-error' : 'actual-help'}
                    />
                    <p id="actual-help" className="field-help">还没收第一季？留空，先按成熟时立即收菜预估。</p>
                    {view.actualError && <p id="actual-error" className="field-error" role="alert">{view.actualError}</p>}
                  </div>
                </div>
              </>
            )}

            <Button type="button" variant="ghost" className="reset-button" onClick={reset}>
              <RotateCcw size={15} /> 重置条件
            </Button>
          </Card>

          <section className="results-column" aria-label="收菜时间结果">
            <Card className="result-primary">
              <div className="result-topline">
                <span className="result-step">02 / 预计收获</span>
                <Badge className="season-badge"><Sprout size={13} /> 第一季</Badge>
              </div>
              {first && firstMoment ? (
                <>
                  <div className="result-main">
                    <div className="result-label">第一季预计收菜时间</div>
                    <div className="result-date"><CalendarDays size={18} /> {firstMoment.date}</div>
                    <time className="result-clock" dateTime={new Date(first.readyAt).toISOString()}>{firstMoment.time}</time>
                  </div>
                  <div className={`countdown-pill ${first.readyAt <= now ? 'is-ready' : ''}`}>
                    <span className="countdown-icon"><Clock3 size={17} /></span>
                    <span>{formatCountdown(first.readyAt, now)}</span>
                    <ArrowRight size={18} className="countdown-arrow" />
                  </div>
                </>
              ) : (
                <div className="empty-result"><CalendarDays size={28} /><strong>等待播种时间</strong><span>填写有效时间后即可查看结果</span></div>
              )}
              <div className="result-decoration" aria-hidden="true"><Sprout /></div>
            </Card>

            {seasons === 2 && (
              <Card className={`result-secondary ${view.actualError ? 'result-secondary--invalid' : ''}`}>
                <div className="secondary-copy">
                  <div className="secondary-topline"><Badge className="season-badge season-badge--second"><Leaf size={13} /> 第二季</Badge><span>{actualFirstHarvestInput && !view.actualError ? '按实际收菜时间' : '预计收菜时间'}</span></div>
                  {second && secondMoment ? (
                    <>
                      <div className="secondary-date">{secondMoment.date}</div>
                      <time className="secondary-clock" dateTime={new Date(second.readyAt).toISOString()}>{secondMoment.time}</time>
                      <div className="secondary-countdown">{formatCountdown(second.readyAt, now)}</div>
                    </>
                  ) : (
                    <div className="secondary-unavailable">{view.actualError ? '请修正第一次实际收菜时间' : '填写播种时间后显示'}</div>
                  )}
                </div>
                <div className="secondary-graphic" aria-hidden="true"><Sprout size={50} strokeWidth={1.3} /></div>
              </Card>
            )}

            <Card className="details-panel">
              <div className="details-heading"><div><span className="section-kicker">HOW IT WORKS</span><h2>收获时间线</h2></div><span className="details-icon"><Clock3 size={18} /></span></div>
              {first ? (
                <ol className="timeline">
                  <li className="timeline-item">
                    <span className="timeline-node timeline-node--start"><Sprout size={14} /></span>
                    <div><span className="timeline-title">播种</span><ScheduleTime timestamp={first.startAt} /></div>
                  </li>
                  <li className="timeline-item">
                    <span className="timeline-node timeline-node--first"><Check size={14} /></span>
                    <div><span className="timeline-title">第一季成熟</span><ScheduleTime timestamp={first.readyAt} /></div>
                  </li>
                  {second && (
                    <>
                      {second.startSource === 'actual-first-harvest' && actualFirstHarvestAt !== null && (
                        <li className="timeline-item">
                          <span className="timeline-node timeline-node--actual"><Leaf size={14} /></span>
                          <div><span className="timeline-title">第一次实际收菜 · 第二季起算</span><ScheduleTime timestamp={actualFirstHarvestAt} /></div>
                        </li>
                      )}
                      <li className="timeline-item">
                        <span className="timeline-node timeline-node--second"><Check size={14} /></span>
                        <div><span className="timeline-title">第二季成熟</span><ScheduleTime timestamp={second.readyAt} /></div>
                      </li>
                    </>
                  )}
                </ol>
              ) : (
                <p className="details-empty">填写播种时间后，时间线会显示在这里。</p>
              )}

              {first && (
                <>
                  <Separator className="details-separator" />
                  <div className="calculation-heading">时间怎么算</div>
                  <div className="calculation-list">
                    <CalculationLine schedule={first} />
                    {second && <CalculationLine schedule={second} />}
                  </div>
                  {second && <p className="calculation-note">第二季从{second.startSource === 'actual-first-harvest' ? '第一次实际收菜时间' : '第一季预计成熟时间'}开始计算。</p>}
                </>
              )}
            </Card>
          </section>
        </div>
      </main>

      <footer className="site-footer"><span>田间时刻 · 让等待有迹可循</span><span>UTC+08:00 · 北京时间</span></footer>
    </div>
  )
}

export default App
