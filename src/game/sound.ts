// 사운드 매니저 — 승격된 오디오(src/assets/audio/<id>.ogg)가 있으면 재생, 없으면 무음 no-op.
// BGM은 유저 제스처(출근하기 클릭) 이후 시작되므로 모바일 자동재생 제약과 충돌하지 않는다.
const AUDIO = import.meta.glob('../assets/audio/*.ogg', { eager: true, query: '?url', import: 'default' }) as Record<string, string>
const urlOf = (id: string): string | null => AUDIO[`../assets/audio/${id}.ogg`] ?? null

const sfxCache: Record<string, HTMLAudioElement> = {}

export function playSfx(id: string): void {
  const u = urlOf(id)
  if (!u) return
  const base = (sfxCache[id] ??= new Audio(u))
  const a = base.cloneNode() as HTMLAudioElement // 동시 재생 허용
  a.volume = 0.9
  void a.play().catch(() => {})
}

let bgm: HTMLAudioElement | null = null
let bgmId: string | null = null

export function startBgm(id: string): void {
  if (bgmId === id) return
  stopBgm()
  const u = urlOf(id)
  if (!u) return
  const a = new Audio(u)
  a.loop = true
  a.volume = 0.5
  bgm = a
  bgmId = id
  void a.play().catch(() => {
    // 자동재생 차단(제스처 전) — 단, 그 사이 다른 트랙이 시작됐다면 그 등록을 지우면 안 됨
    // (지우면 재생 중인 트랙이 '유령'이 되어 stopBgm이 못 멈추고 다음 곡과 겹친다)
    if (bgm === a) {
      bgm = null
      bgmId = null
    }
  })
}

export function stopBgm(): void {
  bgm?.pause()
  bgm = null
  bgmId = null
}

// 지속 동작용 루프 SFX (물 따르기·문지르기) — 동시에 하나만
let loopSfx: HTMLAudioElement | null = null
let loopSfxId: string | null = null

export function startLoopSfx(id: string): void {
  if (loopSfxId === id) return
  stopLoopSfx()
  const u = urlOf(id)
  if (!u) return
  const a = new Audio(u)
  a.loop = true
  a.volume = 0.75
  loopSfx = a
  loopSfxId = id
  void a.play().catch(() => {
    if (loopSfx === a) {
      loopSfx = null
      loopSfxId = null
    }
  })
}

export function stopLoopSfx(): void {
  loopSfx?.pause()
  loopSfx = null
  loopSfxId = null
}
