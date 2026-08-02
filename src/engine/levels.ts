// 레벨 생성 — 테마 설정 × 난이도 파라미터. P5에서 사전 검증 사다리 풀로 대체된다(ADR-001).
// 난이도: 아이템 수 ↑, 제한시간 ↓, 페이크 재료 등장(주문표 표시).
import type { DragItem, DragLevel, TargetSlot, ThemeId, Vec } from './types'
import type { Rng } from './rng'

type ThemeCfg = {
  bg: string
  pool: string[]
  repeatItem?: boolean // true = 같은 아이템 반복(초밥 참치)
  itemSize: Vec
  makeTargets: (wanted: number) => TargetSlot[]
}

export const THEME_ORDER: ThemeId[] = ['sushi', 'gimbap', 'cvs']

const slot = (rect: TargetSlot['rect'], sprite: string, capacity: number): TargetSlot => ({
  rect,
  sprite,
  capacity,
  filled: 0,
})

const THEMES: Record<ThemeId, ThemeCfg> = {
  // 초밥집: 샤리 N개가 늘어서고, 참치를 하나씩 올려 초밥 N개를 완성한다 (슬롯당 1개)
  sushi: {
    bg: 'sushi-bg',
    pool: ['sushi-tuna'],
    repeatItem: true,
    itemSize: { x: 150, y: 92 },
    makeTargets: wanted => {
      const gap = 720 / (wanted + 1)
      return Array.from({ length: wanted }, (_, i) =>
        slot({ x: gap * (i + 1) - 82, y: 600, w: 164, h: 128 }, 'sushi-rice', 1),
      )
    },
  },
  // 김밥천국: 펼친 김밥 위에 주문 재료를 올린다 (단일 슬롯, 주문 수만큼 수용)
  gimbap: {
    bg: 'gimbap-bg',
    pool: ['gimbap-ham', 'gimbap-egg', 'gimbap-pickle', 'gimbap-crab'],
    itemSize: { x: 132, y: 80 },
    makeTargets: wanted => [slot({ x: 160, y: 580, w: 400, h: 180 }, 'gimbap-base', wanted)],
  },
  // 편의점: 주문 상품을 스캐너에 찍는다 (단일 슬롯) — 페이크 상품 주의
  cvs: {
    bg: 'cvs-bg',
    pool: ['cvs-item-ramen', 'cvs-item-drink', 'cvs-item-snack', 'cvs-item-milk'],
    itemSize: { x: 122, y: 122 },
    makeTargets: wanted => [slot({ x: 430, y: 540, w: 230, h: 220 }, 'cvs-scanner', wanted)],
  },
}

const shuffle = <T,>(arr: T[], rng: Rng): T[] => {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng.next() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export function makeLevel(theme: ThemeId, difficulty: number, rng: Rng): DragLevel {
  const cfg = THEMES[theme]
  const wanted = cfg.repeatItem ? Math.min(2 + difficulty, 4) : Math.min(2 + difficulty, 3)
  const wantedIds = cfg.repeatItem
    ? Array.from({ length: wanted }, () => cfg.pool[0])
    : shuffle(cfg.pool, rng).slice(0, wanted)
  const fakePool = cfg.repeatItem ? [] : cfg.pool.filter(id => !wantedIds.includes(id))
  const fakeIds = difficulty >= 1 ? shuffle(fakePool, rng).slice(0, 1) : []

  const timeLimit = Math.round((1500 + wanted * 1300 + fakeIds.length * 400) * Math.pow(0.9, difficulty))

  const allIds = shuffle(
    [
      ...wantedIds.map(id => ({ id, wanted: true })),
      ...fakeIds.map(id => ({ id, wanted: false })),
    ],
    rng,
  )
  const gap = 720 / (allIds.length + 1)
  const items: DragItem[] = allIds.map((e, i) => {
    const home = {
      x: gap * (i + 1) + (rng.next() - 0.5) * 32,
      y: 1060 + (rng.next() - 0.5) * 44,
    }
    return {
      id: e.id,
      key: `${e.id}-${i}`,
      home,
      pos: { ...home },
      size: { ...cfg.itemSize },
      held: false,
      done: false,
      wanted: e.wanted,
    }
  })

  return {
    template: 'drag',
    theme,
    difficulty,
    timeLimit,
    timeRemain: timeLimit,
    targets: cfg.makeTargets(wanted),
    bgSprite: cfg.bg,
    items,
    orderIds: fakeIds.length > 0 ? [...new Set(wantedIds)] : [],
    penaltyT: 0,
  }
}
