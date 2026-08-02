// 템플릿 A — 드래그&드롭: 아이템을 드롭 존으로 옮기면 완료, 전부 옮기면 클리어
import type { DragLevel, PointerInput, PlayResult } from '../types'

const TOUCH_SLOP = 30 // 논리 px — 터치 판정 여유

export function tickDrag(level: DragLevel, dt: number): PlayResult {
  level.timeRemain -= dt
  if (level.items.every(i => i.done)) return 'clear'
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
  const t = level.target
  if (input.x >= t.x && input.x <= t.x + t.w && input.y >= t.y && input.y <= t.y + t.h) {
    held.done = true
    const stacked = level.items.filter(i => i.done).length - 1
    held.pos = { x: t.x + t.w / 2, y: t.y + t.h / 2 - stacked * 26 } // 타깃 위에 쌓기
  } else {
    held.pos = { ...held.home }
  }
}
