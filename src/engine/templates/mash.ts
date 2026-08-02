// 템플릿 C — 연타/스와이프: 택배(연타+이동 타깃), 세차(스와이프 문지르기), 노래방(좌우 교대 연타).
import type { MashLevel, PlayResult, PointerInput } from '../types'

const TAP_SLOP = 40

export function tickMash(level: MashLevel, dt: number): PlayResult {
  level.timeRemain -= dt
  if (level.penaltyT > 0) level.penaltyT -= dt
  if (level.kind === 'shake' && level.gauge < 1) {
    // 게이지 만충(1.0) 도달 시 래치 — 감쇠가 클리어 판정을 선점하면 클리어 불가 (QA 봇이 잡은 버그)
    level.gauge = Math.max(0, level.gauge - level.decay * (dt / 1000))
  }
  const clear =
    level.kind === 'tap'
      ? level.count >= level.goal
      : level.kind === 'scrub'
        ? level.blobs.every(b => b.hp <= 0)
        : level.gauge >= 1
  if (clear) return 'clear'
  if (level.timeRemain <= 0) return 'fail'
  return 'playing'
}

export function applyMashPointer(level: MashLevel, input: PointerInput): void {
  if (level.kind === 'tap') {
    if (input.type !== 'down') return
    const t = level.positions[level.posIdx]
    if (
      input.x >= t.x - TAP_SLOP &&
      input.x <= t.x + t.w + TAP_SLOP &&
      input.y >= t.y - TAP_SLOP &&
      input.y <= t.y + t.h + TAP_SLOP
    ) {
      level.count += 1
      if (level.count < level.goal && level.count % level.movesEvery === 0) {
        level.posIdx = (level.posIdx + 1) % level.positions.length
      }
    }
    return
  }
  if (level.kind === 'scrub') {
    if (input.type === 'down') {
      level.lastP = { x: input.x, y: input.y }
    } else if (input.type === 'move' && level.lastP) {
      const d = Math.hypot(input.x - level.lastP.x, input.y - level.lastP.y)
      if (d > 0) {
        for (const b of level.blobs) {
          if (b.hp > 0 && Math.hypot(input.x - b.x, input.y - b.y) <= b.r) {
            b.hp -= d
          }
        }
      }
      level.lastP = { x: input.x, y: input.y }
    } else if (input.type === 'up') {
      level.lastP = null
    }
    return
  }
  // shake
  if (input.type !== 'down') return
  const side = input.x < 360 ? 'L' : 'R'
  level.gauge = Math.min(1, level.gauge + (side !== level.lastSide ? level.gain : level.gain * 0.35))
  level.lastSide = side
}
