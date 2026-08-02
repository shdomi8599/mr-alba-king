// 템플릿 A — 드래그&드롭: 주문된 아이템을 슬롯에 전부 넣으면 클리어.
// 기믹: 페이크 재료를 넣으면 오답 페널티(시간 차감 + 플래시), 슬롯별 수용량(초밥=샤리당 1개).
import type { DragLevel, PointerInput, PlayResult } from '../types'

const TOUCH_SLOP = 30 // 논리 px
const WRONG_PENALTY_MS = 500
const PENALTY_FLASH_MS = 380

export function tickDrag(level: DragLevel, dt: number): PlayResult {
  level.timeRemain -= dt
  if (level.penaltyT > 0) level.penaltyT -= dt
  if (level.items.filter(i => i.wanted).every(i => i.done)) return 'clear'
  if (level.timeRemain <= 0) return 'fail'
  return 'playing'
}

export function applyPointer(level: DragLevel, input: PointerInput): void {
  if (input.type === 'down') {
    for (let i = level.items.length - 1; i >= 0; i--) {
      const it = level.items[i]
      if (it.done || it.held) continue
      if (
        Math.abs(input.x - it.pos.x) <= it.size.x / 2 + TOUCH_SLOP &&
        Math.abs(input.y - it.pos.y) <= it.size.y / 2 + TOUCH_SLOP
      ) {
        it.held = true
        it.pos = { x: input.x, y: input.y }
        break
      }
    }
    return
  }
  const held = level.items.find(i => i.held)
  if (!held) return
  if (input.type === 'move') {
    held.pos = { x: input.x, y: input.y }
    return
  }
  // up
  held.held = false
  const slot = level.targets.find(
    t =>
      t.filled < t.capacity &&
      input.x >= t.rect.x &&
      input.x <= t.rect.x + t.rect.w &&
      input.y >= t.rect.y &&
      input.y <= t.rect.y + t.rect.h,
  )
  if (!slot) {
    held.pos = { ...held.home }
    return
  }
  if (held.wanted) {
    held.done = true
    slot.filled += 1
    held.pos = {
      x: slot.rect.x + slot.rect.w / 2,
      y: slot.rect.y + slot.rect.h / 2 - (slot.filled - 1) * 24,
    }
  } else {
    // 페이크 재료 — 오답 페널티
    held.pos = { ...held.home }
    level.timeRemain -= WRONG_PENALTY_MS
    level.penaltyT = PENALTY_FLASH_MS
  }
}
