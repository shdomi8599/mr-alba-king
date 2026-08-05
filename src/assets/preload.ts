// 에셋 프리로더 — 저속 회선(모바일)에서 라운드가 넘어갈 때 배경·스프라이트가 늦게 뜨는 팝인 제거.
//
// 문제: <img>/background-image는 "렌더되는 순간" 최초 요청이 나간다. 라운드 전환 = 그 테마 이미지 첫 요청 시점이라
//       회선이 느리면 지연이 그대로 화면에 보인다.
// 전략: (1) 부팅 게이트 — 타이틀·공용 UI·1라운드 에셋만 블로킹 프리로드(진행률 표시)
//       (2) 나머지는 **플레이 순서대로** 백그라운드 선반입 → 큐 자체가 우선순위가 된다
//       (3) 라운드 진입 시 다음 테마를 명시적으로 승격(라운드 점프·순서 이탈 대비 안전망)
//       (4) 이미지는 수신뿐 아니라 decode까지 끝낸다 — 디코드를 표시 순간에 하면 저사양 폰에서 프레임이 튄다
//       (5) 이미지가 끝난 뒤에야 오디오를 받는다(BGM은 지연돼도 게임 진행을 막지 않으므로 최하위)

import { ALL_SPRITES } from './registry'

const AUDIO = import.meta.glob('./audio/*.ogg', { eager: true, query: '?url', import: 'default' }) as Record<string, string>

const done = new Set<string>()
const inflight = new Map<string, Promise<void>>()

/** 이미지 1장을 네트워크 수신 + 디코드까지 완료. 실패해도 resolve(게임 진행을 막지 않는다 — 대역 렌더로 폴백) */
function loadImage(url: string, priority: 'high' | 'low'): Promise<void> {
  if (done.has(url)) return Promise.resolve()
  const running = inflight.get(url)
  if (running) return running

  const p = new Promise<void>(resolve => {
    const img = new Image()
    img.decoding = 'async'
    // fetchPriority: 임계 경로는 높게, 백그라운드 선반입은 낮게 — 같은 커넥션을 두고 경쟁하지 않도록
    ;(img as HTMLImageElement & { fetchPriority?: string }).fetchPriority = priority
    const finish = () => {
      done.add(url)
      inflight.delete(url)
      resolve()
    }
    img.onload = () => (img.decode ? img.decode().then(finish, finish) : finish())
    img.onerror = finish
    img.src = url
  })
  inflight.set(url, p)
  return p
}

/** 동시 요청 수를 제한해 순차 처리 — 모바일에서 한 번에 다 던지면 앞선 요청까지 같이 느려진다 */
async function pool(urls: string[], limit: number, priority: 'high' | 'low', onTick?: () => void): Promise<void> {
  let cursor = 0
  const worker = async () => {
    while (cursor < urls.length) {
      await loadImage(urls[cursor++], priority)
      onTick?.()
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, urls.length) }, worker))
}

const urlsOf = (ids: readonly string[]): string[] => ids.map(id => ALL_SPRITES[id]).filter(Boolean)

// 공용(테마 무소속) 에셋을 필요 시점별로 명시 분류 — 전부 부팅에 묶으면 첫 화면이 그만큼 늦어진다.
const TITLE_IDS = ['title-bg', 'ui-button-full', 'logo-symbol'] // 타이틀 첫 화면
const HUD_IDS = ['ui-order-panel', 'ui-life'] // 인게임 HUD
const OVER_IDS = ['ui-panel', 'ui-boss-happy', 'ui-boss-angry'] // 게임오버 — 최소 30초 뒤 등장

/** 특정 테마가 쓰는 이미지 — id 접두사 규약(`<theme>-*`)으로 묶는다 */
export const themeUrls = (theme: string): string[] =>
  Object.entries(ALL_SPRITES)
    .filter(([id]) => id === theme || id.startsWith(`${theme}-`))
    .map(([, url]) => url)

/** 1단계 게이트: 타이틀 화면에 보이는 것만. 이게 끝나야 로딩 화면이 닫힌다. */
export async function preloadTitle(onProgress?: (ratio: number) => void): Promise<void> {
  const urls = urlsOf(TITLE_IDS)
  let n = 0
  await pool(urls, 3, 'high', () => onProgress?.(++n / urls.length))
}

/**
 * 2단계 게이트: 1라운드 테마 + HUD. 타이틀을 보고 있는 동안 받으므로 대개 체감되지 않지만,
 * 끝나기 전에 누르면 1라운드에서 팝인이 나므로 시작 버튼을 이때까지 잠근다.
 */
export async function preloadFirstRound(theme: string, onProgress?: (ratio: number) => void): Promise<void> {
  const urls = [...new Set([...themeUrls(theme), ...urlsOf(HUD_IDS)])]
  let n = 0
  await pool(urls, 4, 'high', () => onProgress?.(++n / urls.length))
}

/**
 * 나머지 전부를 **플레이 순서대로** 선반입. 큐 순서가 곧 우선순위라 별도 스케줄러가 필요 없다.
 * 게임오버 에셋과 오디오는 그 뒤 — 가장 늦게 필요하다.
 */
export function preloadRest(themes: readonly string[]): void {
  const urls = [...new Set([...themes.slice(1).flatMap(themeUrls), ...urlsOf(OVER_IDS)])]
  void pool(urls, 2, 'low').then(preloadAudio)
}

/** 라운드 진입 시 다음 테마 승격 — 라운드 점프(?round=N)나 순서 이탈에 대한 안전망 */
export function prefetchTheme(theme: string): void {
  void pool(themeUrls(theme), 4, 'high')
}

/** 오디오는 최하위 — 지연돼도 플레이를 막지 않는다 */
function preloadAudio(): void {
  for (const url of Object.values(AUDIO)) {
    if (done.has(url)) continue
    done.add(url)
    const a = new Audio()
    a.preload = 'auto'
    a.src = url
  }
}
