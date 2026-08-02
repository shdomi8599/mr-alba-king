// run-audio.mjs — 오디오 발주 실행기 (fal 단일 SDK, ADR-005)
// SFX: ElevenLabs Sound Effects v2 / BGM: Stable Audio 2.5 → ffmpeg 심리스 루프 폴드(tidy-up 검증 기법 계승) → ogg
// 사용: node tools/run-audio.mjs pipeline/orders/008-audio-batch.json [--force]
import { readFileSync, existsSync, mkdirSync, appendFileSync, writeFileSync, rmSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const SR = 44100

// .env에서 FAL_KEY (dotenv 무의존)
const env = existsSync(path.join(ROOT, '.env')) ? readFileSync(path.join(ROOT, '.env'), 'utf8') : ''
const FAL_KEY = process.env.FAL_KEY || env.match(/^FAL_KEY=(.+)$/m)?.[1]?.trim()
if (!FAL_KEY) {
  console.error('FAL_KEY가 없습니다 — .env에 FAL_KEY=... 를 넣어주세요.')
  process.exit(1)
}

const orderPath = process.argv[2]
const force = process.argv.includes('--force')
const order = JSON.parse(readFileSync(orderPath, 'utf8'))
const EVENTS = path.join(ROOT, 'pipeline', 'events', 'events.jsonl')
const TMP = path.join(ROOT, 'tmp', 'audio')
mkdirSync(TMP, { recursive: true })

const emit = (event, item, detail = {}) =>
  appendFileSync(EVENTS, JSON.stringify({ ts: new Date().toISOString(), order: order.order, item, event, ...detail }) + '\n')

async function falRun(model, input) {
  const res = await fetch(`https://fal.run/${model}`, {
    method: 'POST',
    headers: { Authorization: `Key ${FAL_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  if (!res.ok) throw new Error(`fal ${model} → ${res.status}: ${(await res.text()).slice(0, 200)}`)
  return res.json()
}
const fetchBuf = async url => Buffer.from(await (await fetch(url)).arrayBuffer())

// 임의 오디오 버퍼 → mono f32 PCM (ffmpeg)
function decodePcm(buf) {
  const inP = path.join(TMP, 'in.bin')
  writeFileSync(inP, buf)
  const raw = execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', inP, '-f', 'f32le', '-ac', '1', '-ar', String(SR), '-'], { maxBuffer: 1 << 28 })
  return new Float32Array(raw.buffer, raw.byteOffset, Math.floor(raw.length / 4))
}
// 심리스 루프: 꼬리 X초를 머리에 크로스페이드
function loopFold(pcm) {
  const X = Math.min(Math.floor(4 * SR), Math.floor(pcm.length * 0.18))
  const L = pcm.length - X
  const out = pcm.slice(0, L)
  for (let i = 0; i < X; i++) {
    const r = i / X
    out[i] = pcm[i] * r + pcm[L + i] * (1 - r)
  }
  return out
}
function wav16(b) {
  const n = b.length
  const o = Buffer.alloc(44 + n * 2)
  o.write('RIFF', 0); o.writeUInt32LE(36 + n * 2, 4); o.write('WAVE', 8)
  o.write('fmt ', 12); o.writeUInt32LE(16, 16); o.writeUInt16LE(1, 20); o.writeUInt16LE(1, 22)
  o.writeUInt32LE(SR, 24); o.writeUInt32LE(SR * 2, 28); o.writeUInt16LE(2, 32); o.writeUInt16LE(16, 34)
  o.write('data', 36); o.writeUInt32LE(n * 2, 40)
  for (let i = 0; i < n; i++) o.writeInt16LE(Math.max(-1, Math.min(1, b[i])) * 32767 | 0, 44 + i * 2)
  return o
}
function pcmToOgg(f32, outPath) {
  const w = path.join(TMP, 'o.wav')
  writeFileSync(w, wav16(f32))
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', w, '-c:a', 'libvorbis', '-q:a', '5', outPath])
}
function bufToOgg(buf, outPath) {
  const inP = path.join(TMP, 's.in')
  writeFileSync(inP, buf)
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', inP, '-c:a', 'libvorbis', '-q:a', '5', outPath])
}

for (const item of order.items) {
  const out = path.join(ROOT, order.out.replace('{id}', item.id))
  if (existsSync(out) && !force) { console.log(`skip: ${item.id}`); continue }
  mkdirSync(path.dirname(out), { recursive: true })
  emit('ordered', item.id, { type: item.type })
  console.log(`▶ ${item.id} (${item.type})`)
  try {
    if (item.type === 'sfx') {
      const r = await falRun('fal-ai/elevenlabs/sound-effects/v2', {
        text: item.prompt,
        duration_seconds: item.dur ?? 0.8,
        output_format: 'mp3_44100_128',
        loop: false,
      })
      bufToOgg(await fetchBuf(r.audio.url), out)
    } else {
      const r = await falRun('fal-ai/stable-audio-25/text-to-audio', {
        prompt: item.prompt,
        seconds_total: item.seconds ?? 60,
        seed: item.seed ?? 1,
      })
      pcmToOgg(loopFold(decodePcm(await fetchBuf(r.audio.url))), out)
    }
    emit('generated', item.id, { out: path.relative(ROOT, out) })
    console.log(`✓ ${item.id}`)
  } catch (e) {
    emit('failed', item.id, { reason: String(e.message || e).slice(0, 200) })
    console.error(`✗ ${item.id}: ${e.message}`)
  }
}
rmSync(TMP, { recursive: true, force: true })
console.log('done → 스튜디오 오디오 탭에서 검수')
