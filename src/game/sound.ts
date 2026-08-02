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
  bgm = new Audio(u)
  bgm.loop = true
  bgm.volume = 0.5
  bgmId = id
  void bgm.play().catch(() => {
    // 자동재생 차단(제스처 전) — 상태를 리셋해 다음 제스처에서 재시도 가능하게
    bgm = null
    bgmId = null
  })
}

export function stopBgm(): void {
  bgm?.pause()
  bgm = null
  bgmId = null
}
