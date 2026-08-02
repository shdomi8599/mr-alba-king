// 레벨 생성 — 테마 설정 × 난이도 파라미터. P5에서 사전 검증 사다리 풀로 대체된다(ADR-001).
import type { DragLevel, Rect, ThemeId, Vec } from './types'
import type { Rng } from './rng'

type ThemeCfg = {
  bg: string
  target: string
  targetRect: Rect
  itemPool: string[]
  repeatItem?: boolean // true면 첫 아이템을 개수만큼 반복(초밥 참치)
  itemSize: Vec
  deco?: { id: string; rect: Rect }[]
}

export const THEME_ORDER: ThemeId[] = ['sushi', 'gimbap', 'cvs']

const THEMES: Record<ThemeId, ThemeCfg> = {
  sushi: {
    bg: 'sushi-bg',
    target: 'sushi-rice',
    targetRect: { x: 215, y: 570, w: 290, h: 190 },
    itemPool: ['sushi-tuna'],
    repeatItem: true,
    itemSize: { x: 150, y: 92 },
    deco: [{ id: 'sushi-plate', rect: { x: 150, y: 620, w: 420, h: 200 } }],
  },
  gimbap: {
    bg: 'gimbap-bg',
    target: 'gimbap-base',
    targetRect: { x: 160, y: 580, w: 400, h: 180 },
    itemPool: ['gimbap-ham', 'gimbap-egg', 'gimbap-pickle'],
    itemSize: { x: 132, y: 80 },
  },
  cvs: {
    bg: 'cvs-bg',
    target: 'cvs-scanner',
    targetRect: { x: 430, y: 540, w: 230, h: 220 },
    itemPool: ['cvs-item-ramen', 'cvs-item-drink', 'cvs-item-snack'],
    itemSize: { x: 122, y: 122 },
  },
}

export function makeLevel(theme: ThemeId, difficulty: number, rng: Rng): DragLevel {
  const cfg = THEMES[theme]
  const count = Math.min(1 + difficulty, 3)
  const ids = cfg.repeatItem
    ? Array.from({ length: count }, () => cfg.itemPool[0])
    : [...cfg.itemPool].sort(() => rng.next() - 0.5).slice(0, count)
  const timeLimit = Math.max(3200, Math.round(5500 * Math.pow(0.92, difficulty)))
  const gap = 720 / (ids.length + 1)
  const items = ids.map((id, i) => {
    const home = {
      x: gap * (i + 1) + (rng.next() - 0.5) * 36,
      y: 1060 + (rng.next() - 0.5) * 44,
    }
    return { id, key: `${id}-${i}`, home, pos: { ...home }, size: { ...cfg.itemSize }, held: false, done: false }
  })
  return {
    template: 'drag',
    theme,
    difficulty,
    timeLimit,
    timeRemain: timeLimit,
    target: cfg.targetRect,
    targetSprite: cfg.target,
    bgSprite: cfg.bg,
    deco: cfg.deco ?? [],
    items,
  }
}
