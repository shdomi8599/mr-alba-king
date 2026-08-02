// 엔진 공용 타입 — 이 디렉터리는 DOM/React 무관 순수 TS (봇 QA가 그대로 실행)
export type Vec = { x: number; y: number }
export type Rect = { x: number; y: number; w: number; h: number }

export type ThemeId =
  | 'sushi' | 'gimbap' | 'cvs' | 'bakery' // A 드래그
  | 'cafe' | 'chicken' | 'fish' // B 타이밍
  | 'box' | 'wash' | 'song' // C 연타/스와이프

// ── 템플릿 A: 드래그&드롭 ──
export type TargetSlot = {
  rect: Rect
  sprite: string
  capacity: number
  filled: number
}

export type DragItem = {
  id: string
  key: string
  home: Vec
  pos: Vec
  size: Vec
  held: boolean
  done: boolean
  wanted: boolean // false = 주문에 없는 페이크 — 넣으면 페널티
}

export type DragLevel = {
  template: 'drag'
  theme: ThemeId
  difficulty: number
  timeLimit: number
  timeRemain: number
  targets: TargetSlot[]
  bgSprite: string
  items: DragItem[]
  orderIds: string[] // 주문표 (sequence 모드면 이 순서대로만)
  sequence: boolean // 배치 순서 기믹 (김밥)
  seqIdx: number // 다음에 넣어야 할 orderIds 인덱스
  penaltyT: number
}

// ── 템플릿 B: 타이밍 게이지 ──
export type TimingPattern = 'hold' | 'sine' | 'saw'

export type TimingLevel = {
  template: 'timing'
  theme: ThemeId
  difficulty: number
  timeLimit: number
  timeRemain: number
  bgSprite: string
  deco: { id: string; rect: Rect }[]
  pattern: TimingPattern
  value: number
  t: number
  holding: boolean
  speed: number
  zone: { start: number; end: number }
  reps: number
  done: number
  penaltyT: number
}

// ── 템플릿 C: 연타/스와이프 ──
type MashBase = {
  template: 'mash'
  theme: ThemeId
  difficulty: number
  timeLimit: number
  timeRemain: number
  bgSprite: string
  deco: { id: string; rect: Rect }[]
  penaltyT: number
}
// 택배: 박스를 연타로 옮기기 — 몇 번 칠 때마다 박스 위치가 바뀜
export type TapMash = MashBase & {
  kind: 'tap'
  sprite: string
  positions: Rect[] // 미리 계산된 박스 위치 순환 (시드 RNG — 결정적)
  posIdx: number
  goal: number
  count: number
  movesEvery: number
}
// 세차: 거품을 문질러(스와이프 이동량) 지우기
export type ScrubMash = MashBase & {
  kind: 'scrub'
  blobs: { x: number; y: number; r: number; hp: number; maxHp: number }[]
  lastP: Vec | null
}
// 노래방: 좌/우 번갈아 연타로 흥 게이지 채우기 (같은 쪽 연타는 효율 급감, 게이지는 계속 감쇠)
export type ShakeMash = MashBase & {
  kind: 'shake'
  gauge: number
  gain: number
  decay: number // 초당 감쇠
  lastSide: 'L' | 'R' | null
}
export type MashLevel = TapMash | ScrubMash | ShakeMash

export type Level = DragLevel | TimingLevel | MashLevel

export type PointerInput =
  | { type: 'down'; x: number; y: number }
  | { type: 'move'; x: number; y: number }
  | { type: 'up'; x: number; y: number }

export type PlayResult = 'playing' | 'clear' | 'fail'

// 1라운드 전용 가이드 스텝 (타임스탑 + 스포트라이트)
export type GuideStep = 'drag' | 'drop' | 'order'
