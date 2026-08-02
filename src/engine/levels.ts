// 레벨 생성 — 테마 설정 × 난이도 파라미터. P5에서 사전 검증 사다리 풀로 대체된다(ADR-001).
// 기믹은 1라운드부터: 페이크 재료(주문표), 초밥 세트, 타이밍 구간. 난이도: 수량 ↑, 시간 ↓, 구간 ↓, 속도 ↑.
import type { DragItem, DragLevel, Level, Rect, TargetSlot, ThemeId, TimingLevel, TimingPattern, Vec } from './types'
import type { Rng } from './rng'

// 템플릿 교차 배치: A(드래그) ↔ B(타이밍) — 같은 템플릿 연속 금지
export const THEME_ORDER: ThemeId[] = ['sushi', 'cafe', 'gimbap', 'chicken', 'cvs', 'fish']

const slot = (rect: Rect, sprite: string, capacity: number): TargetSlot => ({ rect, sprite, capacity, filled: 0 })

type DragCfg = {
  template: 'drag'
  bg: string
  pool: string[]
  repeatItem?: boolean
  itemSize: Vec
  makeTargets: (wanted: number) => TargetSlot[]
}
type TimingCfg = {
  template: 'timing'
  bg: string
  pattern: TimingPattern
  deco: { id: string; rect: Rect }[]
}
type ThemeCfg = DragCfg | TimingCfg

const THEMES: Record<ThemeId, ThemeCfg> = {
  // 초밥집: 샤리 N개에 참치를 1:1로 올려 초밥 세트 완성
  sushi: {
    template: 'drag',
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
  // 김밥천국: 주문 재료만 김밥 위에 — 페이크 재료 주의
  gimbap: {
    template: 'drag',
    bg: 'gimbap-bg',
    pool: ['gimbap-ham', 'gimbap-egg', 'gimbap-pickle', 'gimbap-crab'],
    itemSize: { x: 132, y: 80 },
    makeTargets: wanted => [slot({ x: 160, y: 580, w: 400, h: 180 }, 'gimbap-base', wanted)],
  },
  // 편의점: 주문 상품만 스캐너에 — 페이크 상품 주의
  cvs: {
    template: 'drag',
    bg: 'cvs-bg',
    pool: ['cvs-item-ramen', 'cvs-item-drink', 'cvs-item-snack', 'cvs-item-milk'],
    itemSize: { x: 122, y: 122 },
    makeTargets: wanted => [slot({ x: 430, y: 540, w: 230, h: 220 }, 'cvs-scanner', wanted)],
  },
  // 카페: 꾹 눌러 물을 채우고 적정선에서 놓기
  cafe: {
    template: 'timing',
    bg: 'cafe-bg',
    pattern: 'hold',
    deco: [
      { id: 'cafe-kettle', rect: { x: 420, y: 380, w: 200, h: 170 } },
      { id: 'cafe-cup', rect: { x: 250, y: 560, w: 220, h: 190 } },
    ],
  },
  // 치킨집: 왕복 게이지 — 노릇한 순간에 탭
  chicken: {
    template: 'timing',
    bg: 'chicken-bg',
    pattern: 'sine',
    deco: [
      { id: 'chicken-pot', rect: { x: 180, y: 420, w: 360, h: 260 } },
      { id: 'chicken-net', rect: { x: 280, y: 330, w: 160, h: 120 } },
    ],
  },
  // 붕어빵: 반복 상승 게이지 — 타이밍에 탭해서 뒤집기
  fish: {
    template: 'timing',
    bg: 'fish-bg',
    pattern: 'saw',
    deco: [
      { id: 'fish-mold', rect: { x: 170, y: 430, w: 380, h: 250 } },
      { id: 'fish-bread', rect: { x: 280, y: 480, w: 160, h: 140 } },
    ],
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

function makeDragLevel(theme: ThemeId, cfg: DragCfg, difficulty: number, rng: Rng): DragLevel {
  const wanted = cfg.repeatItem ? Math.min(2 + difficulty, 4) : Math.min(2 + difficulty, 3)
  const wantedIds = cfg.repeatItem
    ? Array.from({ length: wanted }, () => cfg.pool[0])
    : shuffle(cfg.pool, rng).slice(0, wanted)
  const fakePool = cfg.repeatItem ? [] : cfg.pool.filter(id => !wantedIds.includes(id))
  const fakeIds = shuffle(fakePool, rng).slice(0, fakePool.length > 0 ? 1 : 0) // 기믹은 1라운드부터

  const timeLimit = Math.round((1500 + wanted * 1300 + fakeIds.length * 400) * Math.pow(0.9, difficulty))

  const allIds = shuffle(
    [...wantedIds.map(id => ({ id, wanted: true })), ...fakeIds.map(id => ({ id, wanted: false }))],
    rng,
  )
  const gap = 720 / (allIds.length + 1)
  const items: DragItem[] = allIds.map((e, i) => {
    const home = { x: gap * (i + 1) + (rng.next() - 0.5) * 32, y: 1060 + (rng.next() - 0.5) * 44 }
    return { id: e.id, key: `${e.id}-${i}`, home, pos: { ...home }, size: { ...cfg.itemSize }, held: false, done: false, wanted: e.wanted }
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

function makeTimingLevel(theme: ThemeId, cfg: TimingCfg, difficulty: number, rng: Rng): TimingLevel {
  const reps = 1 + difficulty
  const zoneWidth = (cfg.pattern === 'hold' ? 0.2 : 0.22) - 0.045 * difficulty
  const zoneStart = 0.5 + rng.next() * (0.92 - zoneWidth - 0.5) // 후반부 어딘가 — 매 레벨 위치 변주
  const speed =
    cfg.pattern === 'hold' ? 0.55 + 0.12 * difficulty : cfg.pattern === 'sine' ? 1.7 + 0.4 * difficulty : 0.5 + 0.13 * difficulty
  const timeLimit = Math.round((2600 + reps * 2200) * Math.pow(0.92, difficulty))
  return {
    template: 'timing',
    theme,
    difficulty,
    timeLimit,
    timeRemain: timeLimit,
    bgSprite: cfg.bg,
    deco: cfg.deco,
    pattern: cfg.pattern,
    value: 0,
    t: 0,
    holding: false,
    speed,
    zone: { start: zoneStart, end: zoneStart + zoneWidth },
    reps,
    done: 0,
    penaltyT: 0,
  }
}

export function makeLevel(theme: ThemeId, difficulty: number, rng: Rng): Level {
  const cfg = THEMES[theme]
  return cfg.template === 'drag'
    ? makeDragLevel(theme, cfg, difficulty, rng)
    : makeTimingLevel(theme, cfg, difficulty, rng)
}
