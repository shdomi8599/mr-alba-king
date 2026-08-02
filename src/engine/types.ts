// 엔진 공용 타입 — 이 디렉터리는 DOM/React 무관 순수 TS (봇 QA가 그대로 실행)
export type Vec = { x: number; y: number }
export type Rect = { x: number; y: number; w: number; h: number }

export type ThemeId = 'sushi' | 'gimbap' | 'cvs' | 'cafe' | 'chicken' | 'fish'

// ── 템플릿 A: 드래그&드롭 ──
export type TargetSlot = {
  rect: Rect
  sprite: string
  capacity: number // 이 슬롯이 받을 수 있는 아이템 수 (초밥 샤리=1, 김밥/스캐너=주문 수)
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
  wanted: boolean // false = 주문에 없는 페이크 재료 — 넣으면 페널티
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
  orderIds: string[] // 주문표 표시용
  penaltyT: number
}

// ── 템플릿 B: 타이밍 게이지 ──
// hold = 꾹 눌러 채우고 구간에서 놓기(카페) / sine = 왕복 게이지에 탭(치킨) / saw = 반복 상승 게이지에 탭(붕어빵)
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
  value: number // 게이지 0..1
  t: number // 패턴 경과 시간(초) — sine/saw 계산용
  holding: boolean // hold 패턴에서 누르는 중
  speed: number // hold: 초당 충전량 / sine: 각속도 / saw: 초당 루프 수
  zone: { start: number; end: number } // 성공 구간
  reps: number // 목표 성공 횟수 (컵/마리/개 수)
  done: number
  penaltyT: number
}

export type Level = DragLevel | TimingLevel

export type PointerInput =
  | { type: 'down'; x: number; y: number }
  | { type: 'move'; x: number; y: number }
  | { type: 'up'; x: number; y: number }

export type PlayResult = 'playing' | 'clear' | 'fail'

// 튜토리얼/JIT 가이드 스텝 (타임스탑 + 스포트라이트)
export type GuideStep = 'drag' | 'drop' | 'order' | 'hold' | 'tapzone'
