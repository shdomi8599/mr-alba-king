// 세션 상태 머신: 지시어 → 플레이 → 판정 → 다음 레벨. 목숨/점수/콤보/난이도 진행.
// 순수 로직 — 렌더는 이 상태를 그리기만 한다. 봇 QA는 tickSession/pointerSession을 직접 호출.
import type { DragLevel, PointerInput } from './types'
import { tickDrag, applyPointer } from './templates/drag'
import { makeLevel, THEME_ORDER } from './levels'
import { mulberry32, type Rng } from './rng'

export const INSTRUCT_MS = 800
export const RESULT_MS = 650
export const LIVES = 3
export const LEVELS_PER_DIFF = 3 // 3레벨 클리어마다 난이도 1단계 상승

export type Phase = 'instruct' | 'play' | 'result' | 'gameover'

export type Session = {
  rng: Rng
  phase: Phase
  phaseT: number
  levelIndex: number
  lives: number
  score: number
  combo: number
  bestCombo: number
  lastResult: 'clear' | 'fail' | null
  lastPerfect: boolean
  levelUpFlash: boolean // 이번 지시어 화면에서 난이도 상승 배너 표시
  level: DragLevel
}

export const difficultyOf = (levelIndex: number): number => Math.floor(levelIndex / LEVELS_PER_DIFF)

export function createSession(seed: number): Session {
  const rng = mulberry32(seed)
  return {
    rng,
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
    level: makeLevel(THEME_ORDER[0], 0, rng),
  }
}

export function tickSession(s: Session, dt: number): void {
  s.phaseT += dt
  if (s.phase === 'instruct') {
    if (s.phaseT >= INSTRUCT_MS) {
      s.phase = 'play'
      s.phaseT = 0
    }
  } else if (s.phase === 'play') {
    const r = tickDrag(s.level, dt)
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
  if (s.phase === 'play') applyPointer(s.level, input)
}
