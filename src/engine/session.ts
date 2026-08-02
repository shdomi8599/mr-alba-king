// 세션 상태 머신: 지시어 → 플레이 → 판정 → 다음 라운드. 목숨/점수/콤보/난이도 진행.
// 총 30라운드 완주제 — 10라운드마다 난이도 1단계 상승(테마 10종 기준, 티어 3개).
// 순수 로직 — 렌더는 이 상태를 그리기만 한다. 봇 QA는 tickSession/pointerSession을 직접 호출.
import type { DragLevel, PointerInput } from './types'
import { tickDrag, applyPointer } from './templates/drag'
import { makeLevel, THEME_ORDER } from './levels'
import { mulberry32, type Rng } from './rng'

export const INSTRUCT_MS = 800
export const RESULT_MS = 650
export const LIVES = 3
export const ROUNDS_TOTAL = 30
export const DIFF_SPAN = 10 // 10라운드마다 난이도 상승 (라운드 1~10 = 0, 11~20 = 1, 21~30 = 2)

export type Phase = 'instruct' | 'play' | 'result' | 'gameover' | 'complete'

export type Session = {
  rng: Rng
  phase: Phase
  phaseT: number
  levelIndex: number // 0-based 라운드 인덱스
  lives: number
  score: number
  combo: number
  bestCombo: number
  lastResult: 'clear' | 'fail' | null
  lastPerfect: boolean
  levelUpFlash: boolean
  level: DragLevel
}

export const difficultyOf = (levelIndex: number): number => Math.floor(levelIndex / DIFF_SPAN)

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
      if (s.levelIndex + 1 >= ROUNDS_TOTAL) {
        s.phase = 'complete' // 30라운드 완주
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
