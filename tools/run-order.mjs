// run-order.mjs — 발주 실행기 (Order-as-Data 시드, STRATEGY §7 / PIPELINE.md)
// 사용: node tools/run-order.mjs pipeline/orders/000-tone-audition.json [--force]
// kind별 어댑터: image = codex exec (골든 ref 있으면 -i 앵커). 모든 전이는 이벤트 스토어에 append.
import { readFileSync, existsSync, mkdirSync, appendFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import path from 'node:path'

const ROOT = path.dirname(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')))
const orderPath = process.argv[2]
const force = process.argv.includes('--force')
if (!orderPath) { console.error('usage: node tools/run-order.mjs <order.json> [--force]'); process.exit(1) }

const order = JSON.parse(readFileSync(orderPath, 'utf8'))
const EVENTS = path.join(ROOT, 'pipeline', 'events', 'events.jsonl')
mkdirSync(path.dirname(EVENTS), { recursive: true })

const emit = (event, item, detail = {}) =>
  appendFileSync(EVENTS, JSON.stringify({ ts: new Date().toISOString(), order: order.order, item, event, ...detail }) + '\n')

const REF = path.join(ROOT, 'pipeline', 'refs', 'style-ref.png')
const hasRef = existsSync(REF)

if (order.kind !== 'image') { console.error(`kind=${order.kind} 어댑터는 아직 없음 (P2에서)`); process.exit(1) }

for (const item of order.items) {
  const out = order.out.replace('{id}', item.id)
  const abs = path.join(ROOT, out)
  if (existsSync(abs) && !force) { console.log(`skip (있음): ${out}`); continue }
  mkdirSync(path.dirname(abs), { recursive: true })

  const anchor = hasRef
    ? 'The attached reference image defines the art style. MATCH IT EXACTLY: same rendering style, same palette and saturation, same outline treatment, same lighting, same viewing angle. '
    : ''
  const prompt =
    `Generate ONE image and save it to the file "${out}" (relative to the current workspace). ` +
    `Subject: ${order.subject}. ` + anchor +
    `Art style: ${item.style}. ` +
    `Output requirements: ${order.common}. ` +
    `Use your image generation tool. Do not create or modify any other files. Do not write code.`

  emit('ordered', item.id, { out, ref: hasRef })
  console.log(`▶ ${item.id} 생성 중...`)
  try {
    // 프롬프트는 stdin으로(이스케이프 안전), Windows에선 cmd 경유(.cmd 셔틀 spawn 제약)
    const args = ['exec', '-s', 'workspace-write']
    if (hasRef) args.push('-i', REF)
    args.push('-')
    const [bin, finalArgs] = process.platform === 'win32'
      ? ['cmd.exe', ['/c', 'codex', ...args]]
      : ['codex', args]
    execFileSync(bin, finalArgs, { cwd: ROOT, input: prompt, stdio: ['pipe', 'inherit', 'inherit'], timeout: 10 * 60 * 1000 })
    if (existsSync(abs)) { emit('generated', item.id, { out }); console.log(`✓ ${out}`) }
    else { emit('failed', item.id, { out, reason: 'output file not found' }); console.error(`✗ 산출물 없음: ${out}`) }
  } catch (e) {
    emit('failed', item.id, { out, reason: String(e.message || e).slice(0, 200) })
    console.error(`✗ ${item.id}: ${e.message}`)
  }
}
console.log('done — 검수: pipeline/staging/tone-audition/index.html')
