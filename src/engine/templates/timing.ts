// 템플릿 B — 타이밍 게이지: 게이지가 성공 구간에 있을 때 조작하면 1회 성공, reps 채우면 클리어.
// hold(카페): 누르는 동안 차오름 → 구간에서 놓기. 넘치면 자동 미스.
// sine(치킨): 게이지 왕복 → 구간에서 탭. saw(붕어빵): 반복 상승 → 구간에서 탭.
import type { PlayResult, PointerInput, TimingLevel } from '../types'

const WRONG_PENALTY_MS = 600
const PENALTY_FLASH_MS = 380

const miss = (level: TimingLevel): void => {
  level.timeRemain -= WRONG_PENALTY_MS
  level.penaltyT = PENALTY_FLASH_MS
}

export function tickTiming(level: TimingLevel, dt: number): PlayResult {
  level.timeRemain -= dt
  if (level.penaltyT > 0) level.penaltyT -= dt
  const sec = dt / 1000
  if (level.pattern === 'hold') {
    if (level.holding) {
      level.value += level.speed * sec
      if (level.value >= 1) {
        // 넘침 — 자동 미스, 다시 눌러야 함
        level.holding = false
        level.value = 0
        miss(level)
      }
    }
  } else {
    level.t += sec
    level.value =
      level.pattern === 'sine'
        ? (Math.sin(level.t * level.speed) + 1) / 2
        : (level.t * level.speed) % 1
  }
  if (level.done >= level.reps) return 'clear'
  if (level.timeRemain <= 0) return 'fail'
  return 'playing'
}

const judge = (level: TimingLevel): void => {
  if (level.value >= level.zone.start && level.value <= level.zone.end) {
    level.done += 1
  } else {
    miss(level)
  }
}

export function applyTimingPointer(level: TimingLevel, input: PointerInput): void {
  if (level.pattern === 'hold') {
    if (input.type === 'down') {
      level.holding = true
      level.value = 0
    } else if (input.type === 'up' && level.holding) {
      level.holding = false
      judge(level)
      level.value = 0
    }
  } else if (input.type === 'down') {
    judge(level)
  }
}
