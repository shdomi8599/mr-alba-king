// qa-bot.ts — 헤드리스 밸런스 시뮬레이터 (P5)
// 페르소나 3종(반응속도·이동속도·연타속도·실수율)이 엔진(tickSession/pointerSession)을 그대로 플레이.
// 렌더 없음 — 로직/렌더 분리(DESIGN 코어 규칙)의 실증. 가이드 off, 시드 고정 = 재현 가능.
// 출력: pipeline/qa-reports/clear-rates.csv + summary.json
// 실행: pnpm exec esbuild tools/qa-bot.ts --bundle --platform=node --format=esm --outfile=tmp/qa-bot.mjs && node tmp/qa-bot.mjs
import { writeFileSync, mkdirSync, appendFileSync } from 'node:fs'
import { createSession, tickSession, pointerSession, type Session } from '../src/engine/session'
import { currentZone } from '../src/engine/templates/timing'
import { mulberry32, type Rng } from '../src/engine/rng'
import type { DragLevel, MashLevel, TimingLevel } from '../src/engine/types'

const DT = 1000 / 60
const SESSIONS_PER_PERSONA = 60

type Persona = {
  name: string
  react: number // 평균 반응 지연 ms
  jitter: number // 반응 표준편차 ms
  moveSpeed: number // 드래그 이동 px/s
  tapRate: number // 연타 taps/s
  errProb: number // 판단 실수 확률(페이크 집기 등)
}
const PERSONAS: Persona[] = [
  { name: 'expert', react: 200, jitter: 60, moveSpeed: 1600, tapRate: 9, errProb: 0.03 },
  { name: 'mid', react: 350, jitter: 90, moveSpeed: 1100, tapRate: 7, errProb: 0.08 },
  { name: 'novice', react: 500, jitter: 130, moveSpeed: 750, tapRate: 5, errProb: 0.15 },
]

const gauss = (rng: Rng): number => {
  const u = Math.max(1e-9, rng.next())
  const v = Math.max(1e-9, rng.next())
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
}
const reactMs = (p: Persona, rng: Rng): number => Math.max(60, p.react + gauss(rng) * p.jitter)

// ── 봇 상태: 레벨마다 초기화되는 행동 플랜 ──
type BotState = {
  wait: number // 다음 행동까지 대기 ms
  dragging: { tx: number; ty: number } | null // 드래그 목표
  px: number
  py: number
  holdTargetV: number | null // hold 패턴 목표 릴리즈 값
  tapPending: number | null // sine/saw 탭 예약 잔여 ms
  scrubGoal: { x: number; y: number } | null
  wiggle: number
  levelKey: string
}

function stepDrag(s: Session, lv: DragLevel, b: BotState, p: Persona, rng: Rng): void {
  if (b.dragging) {
    // 목표 지점으로 이동
    const step = (p.moveSpeed * DT) / 1000
    const dx = b.dragging.tx - b.px
    const dy = b.dragging.ty - b.py
    const d = Math.hypot(dx, dy)
    if (d <= step) {
      b.px = b.dragging.tx
      b.py = b.dragging.ty
      pointerSession(s, { type: 'move', x: b.px, y: b.py })
      pointerSession(s, { type: 'up', x: b.px, y: b.py })
      b.dragging = null
      b.wait = reactMs(p, rng) * 0.6 // 다음 아이템 탐색
    } else {
      b.px += (dx / d) * step
      b.py += (dy / d) * step
      pointerSession(s, { type: 'move', x: b.px, y: b.py })
    }
    return
  }
  // 다음 아이템 선택
  let pick = null
  const undone = lv.items.filter(i => !i.done && !i.held)
  if (rng.next() < p.errProb) {
    pick = undone.find(i => !i.wanted) ?? null // 실수: 페이크 집기
  }
  if (!pick) {
    if (lv.sequence) {
      const need = lv.orderIds[lv.seqIdx]
      pick = undone.find(i => i.wanted && i.id === need) ?? null
    } else {
      pick = undone.find(i => i.wanted) ?? null
    }
  }
  if (!pick) return
  // 드롭 슬롯 결정
  let slot = lv.targets.find(t => t.filled < t.capacity && (t.wants === null || t.wants === pick!.id))
  if (rng.next() < p.errProb * 0.5) {
    // 매칭 실수: 아무 슬롯
    slot = lv.targets.find(t => t.filled < t.capacity) ?? slot
  }
  if (!slot) return
  b.px = pick.pos.x
  b.py = pick.pos.y
  pointerSession(s, { type: 'down', x: b.px, y: b.py })
  b.dragging = { tx: slot.rect.x + slot.rect.w / 2, ty: slot.rect.y + slot.rect.h / 2 }
}

function stepTiming(s: Session, lv: TimingLevel, b: BotState, p: Persona, rng: Rng): void {
  if (lv.pattern === 'hold') {
    if (!lv.holding && b.holdTargetV === null) {
      pointerSession(s, { type: 'down', x: 360, y: 900 })
      const z = currentZone(lv)
      const err = gauss(rng) * lv.speed * (p.react / 1000) * 0.4
      b.holdTargetV = Math.max(0.05, (z.start + z.end) / 2 + err)
    } else if (lv.holding && b.holdTargetV !== null && lv.value >= b.holdTargetV) {
      pointerSession(s, { type: 'up', x: 360, y: 900 })
      b.holdTargetV = null
      b.wait = reactMs(p, rng) * 0.5
    }
    return
  }
  // sine/saw: 구간 진입 감지 → 반응 지연 후 탭
  const z = currentZone(lv)
  const inZone = lv.value >= z.start && lv.value <= z.end
  if (b.tapPending !== null) {
    b.tapPending -= DT
    if (b.tapPending <= 0) {
      pointerSession(s, { type: 'down', x: 360, y: 900 })
      pointerSession(s, { type: 'up', x: 360, y: 900 })
      b.tapPending = null
      b.wait = reactMs(p, rng) * 0.5
    }
  } else if (inZone) {
    b.tapPending = reactMs(p, rng) * 0.6 // 구간 목격 → 지연 후 탭 (지연이 길면 구간 이탈 = 미스)
  }
}

function stepMash(s: Session, lv: MashLevel, b: BotState, p: Persona, rng: Rng): void {
  if (lv.kind === 'tap') {
    b.wait = 1000 / p.tapRate + gauss(rng) * 20
    const t = lv.positions[lv.posIdx]
    const x = t.x + t.w / 2
    const y = t.y + t.h / 2
    pointerSession(s, { type: 'down', x, y })
    pointerSession(s, { type: 'up', x, y })
    return
  }
  if (lv.kind === 'shake') {
    b.wait = 1000 / p.tapRate
    const side = b.wiggle++ % 2 === 0 ? 180 : 540
    pointerSession(s, { type: 'down', x: side, y: 1100 })
    pointerSession(s, { type: 'up', x: side, y: 1100 })
    return
  }
  // scrub: 살아있는 가장 가까운 거품으로 이동하며 문지르기
  const alive = lv.blobs.filter(bl => bl.hp > 0)
  if (!alive.length) return
  if (!b.scrubGoal) {
    pointerSession(s, { type: 'down', x: b.px, y: b.py })
    b.scrubGoal = { x: alive[0].x, y: alive[0].y }
  }
  const target = alive.reduce((a, c) => (Math.hypot(c.x - b.px, c.y - b.py) < Math.hypot(a.x - b.px, a.y - b.py) ? c : a))
  const wob = b.wiggle++ % 6 < 3 ? -target.r * 0.5 : target.r * 0.5
  const gx = target.x + wob
  const gy = target.y + (b.wiggle % 4 < 2 ? -wob : wob) * 0.6
  const step = (p.moveSpeed * DT) / 1000
  const dx = gx - b.px
  const dy = gy - b.py
  const d = Math.hypot(dx, dy)
  const mv = Math.min(step, d)
  if (d > 1) {
    b.px += (dx / d) * mv
    b.py += (dy / d) * mv
    pointerSession(s, { type: 'move', x: b.px, y: b.py })
  }
}

type Cell = { attempts: number; clears: number; timeFracSum: number }
const stats: Record<string, Record<string, Cell>> = {}
const cell = (persona: string, key: string): Cell => {
  stats[persona] = stats[persona] || {}
  return (stats[persona][key] = stats[persona][key] || { attempts: 0, clears: 0, timeFracSum: 0 })
}

let totalLevels = 0
for (const p of PERSONAS) {
  for (let si = 0; si < SESSIONS_PER_PERSONA; si++) {
    const s = createSession(1000 + si, { guide: false })
    const botRng = mulberry32(9000 + si)
    const b: BotState = { wait: 600, dragging: null, px: 360, py: 1100, holdTargetV: null, tapPending: null, scrubGoal: null, wiggle: 0, levelKey: '' }
    let prevPhase = s.phase
    let guard = 0
    while (s.phase !== 'gameover' && s.phase !== 'complete' && guard++ < 400000) {
      tickSession(s, DT)
      // 레벨 전환 감지 → 봇 플랜 리셋 + 결과 기록
      if (prevPhase === 'play' && s.phase === 'result') {
        const key = `${s.level.theme}/d${s.level.difficulty}`
        const c = cell(p.name, key)
        c.attempts++
        totalLevels++
        if (s.lastResult === 'clear') {
          c.clears++
          c.timeFracSum += Math.max(0, s.level.timeRemain / s.level.timeLimit)
        }
      }
      if (prevPhase !== 'play' && s.phase === 'play') {
        b.wait = reactMs(p, botRng)
        b.dragging = null
        b.holdTargetV = null
        b.tapPending = null
        b.scrubGoal = null
        b.px = 360
        b.py = 1100
      }
      prevPhase = s.phase
      if (s.phase !== 'play') continue
      if (b.wait > 0) {
        b.wait -= DT
        continue
      }
      const lv = s.level
      if (lv.template === 'drag') stepDrag(s, lv, b, p, botRng)
      else if (lv.template === 'timing') stepTiming(s, lv, b, p, botRng)
      else stepMash(s, lv, b, p, botRng)
    }
  }
  console.log(`persona ${p.name}: done`)
}

// ── 출력 ──
mkdirSync('pipeline/qa-reports', { recursive: true })
const rows = ['persona,theme,difficulty,attempts,clears,clear_rate,avg_time_frac']
for (const [persona, cells] of Object.entries(stats)) {
  for (const [key, c] of Object.entries(cells).sort()) {
    const [theme, d] = key.split('/')
    rows.push(
      `${persona},${theme},${d},${c.attempts},${c.clears},${(c.clears / c.attempts).toFixed(3)},${c.clears ? (c.timeFracSum / c.clears).toFixed(3) : ''}`,
    )
  }
}
writeFileSync('pipeline/qa-reports/clear-rates.csv', rows.join('\n') + '\n')
writeFileSync(
  'pipeline/qa-reports/summary.json',
  JSON.stringify({ sessionsPerPersona: SESSIONS_PER_PERSONA, personas: PERSONAS, totalLevelAttempts: totalLevels, stats }, null, 2),
)
appendFileSync(
  'pipeline/events/events.jsonl',
  JSON.stringify({ ts: new Date().toISOString(), order: 'qa', item: 'bot-run', event: 'qa-run', sessions: SESSIONS_PER_PERSONA * PERSONAS.length, levelAttempts: totalLevels }) + '\n',
)
console.log(`total level attempts: ${totalLevels} → pipeline/qa-reports/`)
