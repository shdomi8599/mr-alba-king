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
  wants: string | null // 매칭 기믹(초밥): 이 슬롯이 요구하는 아이템 id — 다른 걸 놓으면 페널티
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
  dropFxT: number // 드롭 성공 연출 잔여 ms (편의점=스캔 플래시, 그 외=스파클)
  dropFxSlot: number // 연출이 일어난 슬롯 인덱스
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
  zones: { start: number; end: number }[] // rep마다 다른 성공 구간 — 성공할 때마다 다음 구간으로
  reps: number
  done: number
  penaltyT: number
  repFxT: number // rep 성공 연출 잔여 ms (망 담그기/붕어빵 뒤집기/스파클)
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
  flyT: number // 박스가 트럭 짐칸으로 날아가는 연출 잔여 ms
  flyFrom: Vec | null
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
  hitT: number // 탬버린 흔들림 연출 잔여 ms
  hitSide: 'L' | 'R' | null
  hitCount: number // 음표 파티클 키
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
