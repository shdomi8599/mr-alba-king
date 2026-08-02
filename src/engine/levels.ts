// 레벨 생성 — 테마 10종 × 난이도 파라미터. P5에서 사전 검증 사다리 풀로 대체된다(ADR-001).
// 기믹은 전부 1라운드부터: 세트 완성 / 주문 순서 / 페이크 / 타이밍 구간 / 이동 타깃 / 문지르기 / 좌우 교대.
// 난이도: 수량 ↑, 시간 ↓, 구간 ↓, 속도 ↑.
import type {
  DragItem, DragLevel, Level, MashLevel, Rect, TargetSlot, ThemeId, TimingLevel, TimingPattern, Vec,
} from './types'
import type { Rng } from './rng'

// 템플릿 A/B/C 교차 배치 — 같은 템플릿 연속 금지 (티어 경계 순환 포함)
// 1라운드 = 김밥(주문 순서 기믹) — 가이드가 조작+기믹을 한 번에 안내
export const THEME_ORDER: ThemeId[] = ['gimbap', 'cafe', 'sushi', 'box', 'cvs', 'chicken', 'bakery', 'wash', 'fish', 'song']

const slot = (rect: Rect, sprite: string, capacity: number): TargetSlot => ({ rect, sprite, capacity, filled: 0, wants: null })

// 드래그 기믹 3종 — 모든 A 테마는 이 중 하나를 가진다 (김밥 수준 난이도 평준화)
// sequence: 주문 순서대로만 / match: 슬롯마다 요구 아이템이 다름 / quantity: 같은 아이템 ×n 수량 주문
type DragGimmick = 'sequence' | 'match' | 'quantity'

type DragCfg = {
  template: 'drag'
  bg: string
  pool: string[]
  gimmick: DragGimmick
  itemSize: Vec
  makeTargets: (wanted: number) => TargetSlot[]
}
type TimingCfg = { template: 'timing'; bg: string; pattern: TimingPattern; deco: { id: string; rect: Rect }[] }
type MashCfg =
  | { template: 'mash'; kind: 'tap'; bg: string; sprite: string; size: Vec; area: Rect; deco: { id: string; rect: Rect }[] }
  | { template: 'mash'; kind: 'scrub'; bg: string; area: Rect; deco: { id: string; rect: Rect }[] }
  | { template: 'mash'; kind: 'shake'; bg: string; deco: { id: string; rect: Rect }[] }
type ThemeCfg = DragCfg | TimingCfg | MashCfg

const THEMES: Record<ThemeId, ThemeCfg> = {
  // ── A 드래그 ──
  // 초밥집: 샤리마다 요구 어종이 다름(매칭) — 참치/연어/계란을 맞는 샤리에
  sushi: {
    template: 'drag',
    bg: 'sushi-bg',
    pool: ['sushi-tuna', 'sushi-salmon', 'sushi-egg'],
    gimmick: 'match',
    itemSize: { x: 150, y: 92 },
    makeTargets: wanted => {
      const gap = 720 / (wanted + 1)
      return Array.from({ length: wanted }, (_, i) => slot({ x: gap * (i + 1) - 82, y: 600, w: 164, h: 128 }, 'sushi-rice', 1))
    },
  },
  gimbap: {
    template: 'drag',
    bg: 'gimbap-bg',
    pool: ['gimbap-ham', 'gimbap-egg', 'gimbap-pickle', 'gimbap-crab'],
    gimmick: 'sequence', // 주문 순서대로만
    itemSize: { x: 132, y: 80 },
    makeTargets: wanted => [slot({ x: 160, y: 580, w: 400, h: 180 }, 'gimbap-base', wanted)],
  },
  cvs: {
    template: 'drag',
    bg: 'cvs-bg',
    pool: ['cvs-item-ramen', 'cvs-item-drink', 'cvs-item-snack', 'cvs-item-milk'],
    gimmick: 'quantity', // 같은 상품 ×n 수량 주문
    itemSize: { x: 122, y: 122 },
    makeTargets: wanted => [slot({ x: 430, y: 540, w: 230, h: 220 }, 'cvs-scanner', wanted)],
  },
  bakery: {
    template: 'drag',
    bg: 'bakery-bg',
    pool: ['bakery-bread-cream', 'bakery-bread-red', 'bakery-bread-salt', 'bakery-bread-choco'],
    gimmick: 'quantity',
    itemSize: { x: 134, y: 96 },
    makeTargets: wanted => [slot({ x: 180, y: 560, w: 360, h: 200 }, 'bakery-tray', wanted)],
  },
  // ── B 타이밍 ──
  cafe: {
    template: 'timing',
    bg: 'cafe-bg',
    pattern: 'hold',
    deco: [
      { id: 'cafe-kettle', rect: { x: 420, y: 380, w: 200, h: 170 } },
      { id: 'cafe-cup', rect: { x: 250, y: 560, w: 220, h: 190 } },
    ],
  },
  chicken: {
    template: 'timing',
    bg: 'chicken-bg',
    pattern: 'sine',
    deco: [
      { id: 'chicken-pot', rect: { x: 180, y: 420, w: 360, h: 260 } },
      { id: 'chicken-net', rect: { x: 280, y: 330, w: 160, h: 120 } },
    ],
  },
  fish: {
    template: 'timing',
    bg: 'fish-bg',
    pattern: 'saw',
    deco: [
      { id: 'fish-mold', rect: { x: 170, y: 430, w: 380, h: 250 } },
      { id: 'fish-bread', rect: { x: 280, y: 480, w: 160, h: 140 } },
    ],
  },
  // ── C 연타/스와이프 ──
  box: {
    template: 'mash',
    kind: 'tap',
    bg: 'box-bg',
    sprite: 'box-parcel',
    size: { x: 180, y: 150 },
    area: { x: 60, y: 420, w: 480, h: 520 },
    deco: [{ id: 'box-truck', rect: { x: 480, y: 300, w: 220, h: 300 } }],
  },
  wash: {
    template: 'mash',
    kind: 'scrub',
    bg: 'wash-bg',
    area: { x: 110, y: 470, w: 500, h: 300 },
    deco: [{ id: 'wash-car', rect: { x: 90, y: 450, w: 540, h: 330 } }],
  },
  song: {
    template: 'mash',
    kind: 'shake',
    bg: 'song-bg',
    deco: [
      { id: 'song-tambourine', rect: { x: 250, y: 460, w: 220, h: 220 } },
      { id: 'song-mic', rect: { x: 500, y: 420, w: 110, h: 210 } },
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
  let wantedIds: string[]
  let fakeIds: string[] = []
  let targets: TargetSlot[]

  if (cfg.gimmick === 'match') {
    // 슬롯마다 요구 아이템을 랜덤 배정(중복 허용) — 아이템은 요구 목록과 정확히 일치
    const wanted = Math.min(2 + difficulty, 4)
    const slotWants = Array.from({ length: wanted }, () => cfg.pool[Math.floor(rng.next() * cfg.pool.length)])
    targets = cfg.makeTargets(wanted)
    targets.forEach((t, i) => (t.wants = slotWants[i]))
    wantedIds = shuffle(slotWants, rng)
  } else if (cfg.gimmick === 'quantity') {
    // 수량 주문: 상품 2종 중 일부는 ×n — 총 3+diff개(최대 4) + 페이크 1
    const count = Math.min(3 + difficulty, 4)
    const distinct = shuffle(cfg.pool, rng).slice(0, 2)
    wantedIds = [
      ...distinct,
      ...Array.from({ length: count - 2 }, () => distinct[Math.floor(rng.next() * distinct.length)]),
    ]
    const fakePool = cfg.pool.filter(id => !distinct.includes(id))
    fakeIds = shuffle(fakePool, rng).slice(0, 1)
    targets = cfg.makeTargets(count)
  } else {
    // sequence(김밥): 서로 다른 재료를 주문 순서대로
    const wanted = Math.min(2 + difficulty, 3)
    wantedIds = shuffle(cfg.pool, rng).slice(0, wanted)
    const fakePool = cfg.pool.filter(id => !wantedIds.includes(id))
    fakeIds = shuffle(fakePool, rng).slice(0, 1)
    targets = cfg.makeTargets(wanted)
  }

  const sequence = cfg.gimmick === 'sequence'
  const timeLimit = Math.round(
    (1500 +
      wantedIds.length * 1300 +
      fakeIds.length * 400 +
      (sequence ? 500 : 0) +
      (cfg.gimmick === 'match' ? wantedIds.length * 250 : 0)) *
      Math.pow(0.9, difficulty),
  )

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
    targets,
    bgSprite: cfg.bg,
    items,
    // match는 슬롯 위 칩이 주문표 역할 — 별도 주문 패널 없음
    orderIds: cfg.gimmick === 'match' ? [] : wantedIds,
    sequence,
    seqIdx: 0,
    penaltyT: 0,
  }
}

function makeTimingLevel(theme: ThemeId, cfg: TimingCfg, difficulty: number, rng: Rng): TimingLevel {
  const reps = Math.min(2 + difficulty, 4)
  const zoneWidth = (cfg.pattern === 'hold' ? 0.21 : 0.22) - 0.04 * difficulty
  // rep마다 다른 구간 — 성공할 때마다 목표선이 이동한다 (hold는 40% 이상 구간 보장)
  const minStart = cfg.pattern === 'hold' ? 0.4 : 0.15
  const zones = Array.from({ length: reps }, () => {
    const start = minStart + rng.next() * (0.92 - zoneWidth - minStart)
    return { start, end: start + zoneWidth }
  })
  const speed =
    cfg.pattern === 'hold' ? 0.55 + 0.12 * difficulty : cfg.pattern === 'sine' ? 1.7 + 0.4 * difficulty : 0.5 + 0.13 * difficulty
  const timeLimit = Math.round((2000 + reps * 2000) * Math.pow(0.92, difficulty))
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
    zones,
    reps,
    done: 0,
    penaltyT: 0,
  }
}

function makeMashLevel(theme: ThemeId, cfg: MashCfg, difficulty: number, rng: Rng): MashLevel {
  if (cfg.kind === 'tap') {
    const goal = 12 + 5 * difficulty
    const positions: Rect[] = Array.from({ length: 8 }, () => ({
      x: cfg.area.x + rng.next() * (cfg.area.w - cfg.size.x),
      y: cfg.area.y + rng.next() * (cfg.area.h - cfg.size.y),
      w: cfg.size.x,
      h: cfg.size.y,
    }))
    return {
      template: 'mash', kind: 'tap', theme, difficulty,
      timeLimit: Math.round((1600 + goal * 240) * Math.pow(0.92, difficulty)),
      timeRemain: Math.round((1600 + goal * 240) * Math.pow(0.92, difficulty)),
      bgSprite: cfg.bg, deco: cfg.deco, penaltyT: 0,
      sprite: cfg.sprite, positions, posIdx: 0, goal, count: 0, movesEvery: 3,
    }
  }
  if (cfg.kind === 'scrub') {
    const n = 4 + difficulty
    const blobs = Array.from({ length: n }, () => {
      const r = 58 + rng.next() * 30
      const hp = 260 + 50 * difficulty
      return {
        x: cfg.area.x + r + rng.next() * (cfg.area.w - r * 2),
        y: cfg.area.y + r + rng.next() * (cfg.area.h - r * 2),
        r, hp, maxHp: hp,
      }
    })
    const timeLimit = Math.round((2400 + n * 850) * Math.pow(0.92, difficulty))
    return {
      template: 'mash', kind: 'scrub', theme, difficulty,
      timeLimit, timeRemain: timeLimit,
      bgSprite: cfg.bg, deco: cfg.deco, penaltyT: 0,
      blobs, lastP: null,
    }
  }
  const timeLimit = Math.round(6200 * Math.pow(0.92, difficulty))
  return {
    template: 'mash', kind: 'shake', theme, difficulty,
    timeLimit, timeRemain: timeLimit,
    bgSprite: cfg.bg, deco: cfg.deco, penaltyT: 0,
    gauge: 0, gain: 0.085 - 0.006 * difficulty, decay: 0.16 + 0.05 * difficulty, lastSide: null,
  }
}

export function makeLevel(theme: ThemeId, difficulty: number, rng: Rng): Level {
  const cfg = THEMES[theme]
  if (cfg.template === 'drag') return makeDragLevel(theme, cfg, difficulty, rng)
  if (cfg.template === 'timing') return makeTimingLevel(theme, cfg, difficulty, rng)
  return makeMashLevel(theme, cfg, difficulty, rng)
}
