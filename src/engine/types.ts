// 엔진 공용 타입 — 이 디렉터리는 DOM/React 무관 순수 TS (봇 QA가 그대로 실행)
export type Vec = { x: number; y: number }
export type Rect = { x: number; y: number; w: number; h: number }

export type ThemeId = 'sushi' | 'gimbap' | 'cvs'

export type DragItem = {
  id: string // 스프라이트(에셋) id
  key: string // 렌더/추적용 고유 키
  home: Vec // 시작 위치(중심)
  pos: Vec // 현재 위치(중심)
  size: Vec
  held: boolean
  done: boolean
}

export type DragLevel = {
  template: 'drag'
  theme: ThemeId
  difficulty: number
  timeLimit: number // ms
  timeRemain: number // ms
  target: Rect // 드롭 존 (논리 좌표 720×1280)
  targetSprite: string
  bgSprite: string
  deco: { id: string; rect: Rect }[]
  items: DragItem[]
}

export type PointerInput =
  | { type: 'down'; x: number; y: number }
  | { type: 'move'; x: number; y: number }
  | { type: 'up'; x: number; y: number }

export type PlayResult = 'playing' | 'clear' | 'fail'
