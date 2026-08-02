// 세션 상태 머신: 지시어 → 플레이 → 판정 → 다음 라운드. 목숨/점수/콤보/난이도 진행.
// 총 30라운드 완주제 — 10라운드마다 난이도 1단계 상승(테마 10종 기준, 티어 3개).
// 가이드(튜토리얼): 1라운드 조작 안내 + 기믹(주문표/타이밍) 첫 등장 시 1회 — 타임스탑 + 스포트라이트.
// 순수 로직 — 렌더는 이 상태를 그리기만 한다. 봇 QA는 tickSession/pointerSession을 직접 호출(가이드 off).
import type { GuideStep, Level, PointerInput } from './types'
import { tickDrag, applyPointer } from './templates/drag'
import { tickTiming, applyTimingPointer } from './templates/timing'
import { tickMash, applyMashPointer } from './templates/mash'
import { makeLevel, THEME_ORDER } from './levels'
import { mulberry32, type Rng } from './rng'

export const INSTRUCT_MS = 800
export const RESULT_MS = 650
export const LIVES = 3
export const ROUNDS_TOTAL = 30
export const DIFF_SPAN = 10 // 10라운드마다 난이도 상승 (1~10 = 0, 11~20 = 1, 21~30 = 2)

export type Phase = 'instruct' | 'play' | 'result' | 'gameover' | 'complete'

export type Session = {
  rng: Rng
  guideEnabled: boolean
  phase: Phase
  phaseT: number
  levelIndex: number
  lives: number
  score: number
  combo: number
  bestCombo: number
  lastResult: 'clear' | 'fail' | null
  lastPerfect: boolean
  levelUpFlash: boolean
  guide: GuideStep[] // 1라운드 전용 — 비어있지 않으면 타임스탑
  level: Level
}

export const difficultyOf = (levelIndex: number): number => Math.floor(levelIndex / DIFF_SPAN)

export function createSession(seed: number, opts?: { guide?: boolean }): Session {
  const rng = mulberry32(seed)
  return {
    rng,
    guideEnabled: opts?.guide ?? true,
    phase: 'instruct',
    phaseT: 0,
    levelIndex: 0,
    lives: LIVES,
    score: 0,
    combo: 0,
    bestCombo: 0,
    lastResult: null,
    lastPerfect: false,
    levelUpFlash: false,
    guide: [],
    level: makeLevel(THEME_ORDER[0], 0, rng),
  }
}

// 가이드는 1라운드에서만: 조작(잡기→놓기) + 그 라운드의 기믹(주문 순서)까지 한 번에 확인
function buildGuide(s: Session): void {
  if (!s.guideEnabled || s.levelIndex !== 0) return
  const lv = s.level
  if (lv.template !== 'drag') return
  const steps: GuideStep[] = ['drag', 'drop']
  if (lv.orderIds.length > 0) steps.push('order')
  s.guide = steps
}

export function tickSession(s: Session, dt: number): void {
  s.phaseT += dt
  if (s.phase === 'instruct') {
    if (s.phaseT >= INSTRUCT_MS) {
      s.phase = 'play'
      s.phaseT = 0
      buildGuide(s)
    }
  } else if (s.phase === 'play') {
    if (s.guide.length > 0) return // 가이드 중 타임스탑
    const r =
      s.level.template === 'drag'
        ? tickDrag(s.level, dt)
        : s.level.template === 'timing'
          ? tickTiming(s.level, dt)
          : tickMash(s.level, dt)
    if (r === 'clear') {
      const frac = Math.max(0, s.level.timeRemain / s.level.timeLimit)
      s.lastPerfect = frac >= 0.4
      s.score += 100 + Math.round(frac * 100) + (s.lastPerfect ? 50 : 0)
      s.combo += 1
      s.bestCombo = Math.max(s.bestCombo, s.combo)
      s.lastResult = 'clear'
      s.phase = 'result'
      s.phaseT = 0
    } else if (r === 'fail') {
      s.lives -= 1
      s.combo = 0
      s.lastResult = 'fail'
      s.lastPerfect = false
      s.phase = 'result'
      s.phaseT = 0
    }
  } else if (s.phase === 'result') {
    if (s.phaseT >= RESULT_MS) {
      if (s.lives <= 0) {
        s.phase = 'gameover'
        s.phaseT = 0
        return
      }
      if (s.levelIndex + 1 >= ROUNDS_TOTAL) {
        s.phase = 'complete'
        s.phaseT = 0
        return
      }
      const prevDiff = difficultyOf(s.levelIndex)
      s.levelIndex += 1
      const diff = difficultyOf(s.levelIndex)
      s.levelUpFlash = diff > prevDiff
      s.level = makeLevel(THEME_ORDER[s.levelIndex % THEME_ORDER.length], diff, s.rng)
      s.phase = 'instruct'
      s.phaseT = 0
      s.lastResult = null
    }
  }
}

export function pointerSession(s: Session, input: PointerInput): void {
  if (s.phase !== 'play') return
  if (s.guide.length > 0) {
    if (input.type === 'down') s.guide = s.guide.slice(1) // 탭하면 다음 가이드 → 모두 끝나면 시간 시작
    return
  }
  if (s.level.template === 'drag') applyPointer(s.level, input)
  else if (s.level.template === 'timing') applyTimingPointer(s.level, input)
  else applyMashPointer(s.level, input)
}
