// promote.mjs — 승인된 스테이징 에셋을 게임으로 승격 + 웹 최적화
// staging PNG → src/assets/img/<id>.webp (ffmpeg: 배경 h1280 리사이즈 / 스프라이트 w512, 알파 유지)
// 승인 상태는 이벤트 스토어에서 파생(최신 결정 우선). 승격도 이벤트로 기록.
// 사용: node tools/promote.mjs
import { readFileSync, existsSync, readdirSync, mkdirSync, appendFileSync, rmSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const EVENTS = path.join(ROOT, 'pipeline', 'events', 'events.jsonl')
const DEST = path.join(ROOT, 'src', 'assets', 'img')
mkdirSync(DEST, { recursive: true })

const events = readFileSync(EVENTS, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l))
const latest = {}
for (const e of events) if (e.event === 'approved' || e.event === 'rejected') latest[`${e.order}/${e.item}`] = e.event

const orders = readdirSync(path.join(ROOT, 'pipeline', 'orders'))
  .filter(f => f.endsWith('.json'))
  .map(f => JSON.parse(readFileSync(path.join(ROOT, 'pipeline', 'orders', f), 'utf8')))

let n = 0
// 오디오 승격: 승인된 후보 → src/assets/audio/<정식 id>.ogg (BGM 후보 접미사 -a/-b/... 제거)
const AUDIO_DEST = path.join(ROOT, 'src', 'assets', 'audio')
for (const o of orders) {
  if (o.kind !== 'audio') continue
  for (const it of o.items || []) {
    if (latest[`${o.order}/${it.id}`] !== 'approved') continue
    const src = path.join(ROOT, o.out.replace('{id}', it.id))
    if (!existsSync(src)) continue
    mkdirSync(AUDIO_DEST, { recursive: true })
    const canonical = it.canonical ?? (it.type === 'bgm' ? it.id.replace(/-[a-e]$/, '') : it.id)
    const dest = path.join(AUDIO_DEST, `${canonical}.ogg`)
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', src, '-c', 'copy', dest])
    appendFileSync(EVENTS, JSON.stringify({ ts: new Date().toISOString(), order: o.order, item: it.id, event: 'promoted', to: `src/assets/audio/${canonical}.ogg` }) + '\n')
    n++
    console.log(`✓ ${it.id} → ${canonical}.ogg`)
  }
}

for (const o of orders) {
  if (o.kind !== 'image') continue
  if (o.order === 0) continue // 톤 오디션은 레퍼런스이지 게임 에셋이 아님
  for (const it of o.items || []) {
    if (latest[`${o.order}/${it.id}`] !== 'approved') continue
    const src = path.join(ROOT, o.out.replace('{id}', it.id))
    if (!existsSync(src)) continue
    const dest = path.join(DEST, `${it.id}.webp`)
    const isBg = it.id.endsWith('-bg')
    // 배경: 캔버스 높이(1280)에 맞춰 리사이즈 / 스프라이트: 최대 512px — 알파 유지 webp
    const vf = isBg ? 'scale=-2:1280' : "scale='min(512,iw)':-2"
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', src, '-vf', vf, '-c:v', 'libwebp', '-quality', '84', dest])
    rmSync(path.join(DEST, `${it.id}.png`), { force: true }) // 구버전 png 정리
    appendFileSync(EVENTS, JSON.stringify({ ts: new Date().toISOString(), order: o.order, item: it.id, event: 'promoted', to: `src/assets/img/${it.id}.webp` }) + '\n')
    n++
    console.log(`✓ ${it.id}`)
  }
}
console.log(`promoted: ${n}`)
