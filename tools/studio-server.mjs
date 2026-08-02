// studio-server.mjs — 디렉터 스튜디오 서버 (의존성 0)
// http://localhost:4900/ = 검수 UI. 정적 서빙 + 상태 API + 결정(승인/반려/골든ref) API.
// 모든 결정은 pipeline/events/events.jsonl에 append — 최신 이벤트가 이김 = 결정은 언제든 번복 가능.
import { createServer } from 'node:http'
import { readFileSync, existsSync, statSync, readdirSync, appendFileSync, copyFileSync, mkdirSync } from 'node:fs'
import { execSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const PORT = Number(process.env.STUDIO_PORT) || 4900
const EVENTS = path.join(ROOT, 'pipeline', 'events', 'events.jsonl')
const REF = path.join(ROOT, 'pipeline', 'refs', 'style-ref.png')
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.css': 'text/css', '.json': 'application/json', '.md': 'text/plain; charset=utf-8',
  '.png': 'image/png', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.webp': 'image/webp',
  '.ogg': 'audio/ogg', '.mp3': 'audio/mpeg', '.wav': 'audio/wav',
}

const readEvents = () => {
  if (!existsSync(EVENTS)) return []
  return readFileSync(EVENTS, 'utf8').split('\n').filter(Boolean).map(l => { try { return JSON.parse(l) } catch { return null } }).filter(Boolean)
}
const emit = (e) => {
  mkdirSync(path.dirname(EVENTS), { recursive: true })
  appendFileSync(EVENTS, JSON.stringify({ ts: new Date().toISOString(), ...e }) + '\n')
}

function scanAudio(dir, base = '') {
  const abs = path.join(ROOT, 'pipeline', 'staging', 'audio', dir)
  if (!existsSync(abs)) return []
  return readdirSync(abs, { withFileTypes: true }).flatMap(d => {
    const rel = path.posix.join(base, d.name)
    if (d.isDirectory()) return scanAudio(path.join(dir, d.name), rel)
    return /\.(ogg|mp3|wav)$/.test(d.name) ? [{ name: rel, url: `/pipeline/staging/audio/${path.posix.join(dir.replaceAll('\\', '/'), d.name)}` }] : []
  })
}

function state() {
  const events = readEvents()
  const latest = {} // `${order}/${item}` → 마지막 승인/반려
  let golden = null
  for (const e of events) {
    if (e.event === 'approved' || e.event === 'rejected') latest[`${e.order}/${e.item}`] = e
    if (e.event === 'promoted-golden-ref') golden = { order: e.order, item: e.item }
  }
  const orderFiles = existsSync(path.join(ROOT, 'pipeline', 'orders'))
    ? readdirSync(path.join(ROOT, 'pipeline', 'orders')).filter(f => f.endsWith('.json')).sort()
    : []
  const orders = orderFiles.map(f => {
    const o = JSON.parse(readFileSync(path.join(ROOT, 'pipeline', 'orders', f), 'utf8'))
    return {
      file: f, order: o.order, name: o.name, kind: o.kind, goal: o.goal || '',
      items: (o.items || []).map(it => {
        const out = o.out.replace('{id}', it.id)
        const decision = latest[`${o.order}/${it.id}`]
        return {
          id: it.id, label: it.label || it.id, style: it.style || '', out, url: '/' + out.replaceAll('\\', '/'),
          exists: existsSync(path.join(ROOT, out)),
          status: decision ? decision.event : (existsSync(path.join(ROOT, out)) ? 'generated' : 'pending'),
          reason: decision?.reason || null,
          isGolden: golden && golden.order === o.order && golden.item === it.id,
        }
      }),
    }
  })
  const counts = { ordered: 0, generated: 0, approved: 0, rejected: 0 }
  for (const e of events) if (counts[e.event] !== undefined) counts[e.event]++
  const docs = existsSync(path.join(ROOT, 'docs')) ? readdirSync(path.join(ROOT, 'docs')).filter(f => f.endsWith('.md')).sort() : []

  const readJson = (p, fb) => { try { return JSON.parse(readFileSync(path.join(ROOT, 'pipeline', p), 'utf8')) } catch { return fb } }
  const criteria = readJson('criteria.json', {})
  const status = readJson('status.json', {})

  // 매니페스트 슬롯 상태 파생: source(order/item) → 이벤트 기반, 없으면 기획됨
  const itemIndex = {}
  for (const o of orders) for (const it of o.items) itemIndex[`${o.order}/${it.id}`] = it
  const manifest = readJson('manifest.json', { categories: [] })
  for (const cat of manifest.categories || []) {
    for (const slot of cat.slots || []) {
      if (slot.source) {
        const it = itemIndex[`${slot.source.order}/${slot.source.item}`]
        slot.status = it ? (it.isGolden ? 'golden' : it.status) : 'ordered'
        slot.url = it?.exists ? it.url : null
      } else slot.status = 'planned'
    }
  }

  let gitLog = []
  try {
    gitLog = execSync('git log -n 40 "--pretty=format:%h|%ad|%s" "--date=format:%m-%d %H:%M"', { cwd: ROOT, encoding: 'utf8' })
      .split('\n').filter(Boolean).map(l => { const [hash, date, ...m] = l.split('|'); return { hash, date, msg: m.join('|') } })
  } catch {}

  // 히스토리 스레드: 아이템별 이벤트 체인 (원인→결과)
  const threads = {}
  for (const e of events) {
    if (e.order === undefined || !e.item) continue
    const k = `${e.order}/${e.item}`
    ;(threads[k] = threads[k] || []).push(e)
  }

  return {
    goldenRef: golden ? { ...golden, exists: existsSync(REF) } : null,
    orders, audio: scanAudio(''), docs, counts, events: events.slice(-60).reverse(),
    criteria, status, manifest, gitLog, threads,
  }
}

const json = (res, code, obj) => { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(obj)) }
const body = (req) => new Promise(r => { let d = ''; req.on('data', c => d += c); req.on('end', () => { try { r(JSON.parse(d || '{}')) } catch { r({}) } }) })

createServer(async (req, res) => {
  try {
    const p = decodeURIComponent(new URL(req.url, 'http://x').pathname)

    if (p === '/api/state') return json(res, 200, state())

    if (p === '/api/decision' && req.method === 'POST') {
      const { order, item, decision, reason } = await body(req)
      if (!['approved', 'rejected'].includes(decision)) return json(res, 400, { error: 'decision must be approved|rejected' })
      emit({ order, item, event: decision, ...(reason ? { reason } : {}), by: 'director' })
      return json(res, 200, { ok: true })
    }

    if (p === '/api/golden-ref' && req.method === 'POST') {
      const { order, item } = await body(req)
      const st = state()
      const o = st.orders.find(x => x.order === order)
      const it = o?.items.find(x => x.id === item)
      if (!it?.exists) return json(res, 400, { error: 'file not found' })
      mkdirSync(path.dirname(REF), { recursive: true })
      copyFileSync(path.join(ROOT, it.out), REF)
      emit({ order, item, event: 'promoted-golden-ref', by: 'director' })
      emit({ order, item, event: 'approved', by: 'director' })
      return json(res, 200, { ok: true })
    }

    // 정적 서빙 — '/' 는 스튜디오 UI
    let file = p === '/' ? path.join(ROOT, 'tools', 'studio', 'index.html') : path.join(ROOT, p)
    if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end() }
    if (existsSync(file) && statSync(file).isDirectory()) file = path.join(file, 'index.html')
    if (!existsSync(file)) { res.writeHead(404); return res.end('404') }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' })
    res.end(readFileSync(file))
  } catch (e) { res.writeHead(500); res.end(String(e)) }
}).listen(PORT, () => console.log(`studio → http://localhost:${PORT}/`))
