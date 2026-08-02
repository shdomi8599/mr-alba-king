// 엔진 공용 타입 — 이 디렉터리는 DOM/React 무관 순수 TS (봇 QA가 그대로 실행)
export type Vec = { x: number; y: number }
export type Rect = { x: number; y: number; w: number; h: number }

export type ThemeId = 'sushi' | 'gimbap' | 'cvs'

export type TargetSlot = {
  rect: Rect
  sprite: string
  capacity: number // 이 슬롯이 받을 수 있는 아이템 수 (초밥 샤리=1, 김밥/스캐너=주문 수)
  filled: number
}

export type DragItem = {
  id: string // 스프라이트(에셋) id
  key: string // 렌더/추적용 고유 키
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
  timeLimit: number // ms
  timeRemain: number // ms
  targets: TargetSlot[]
  bgSprite: string
  items: DragItem[]
  orderIds: string[] // 주문표 표시용 (페이크가 섞일 때만 비어있지 않음)
  penaltyT: number // 오답 페널티 플래시 잔여 ms
}

export type PointerInput =
  | { type: 'down'; x: number; y: number }
  | { type: 'move'; x: number; y: number }
  | { type: 'up'; x: number; y: number }

export type PlayResult = 'playing' | 'clear' | 'fail'
