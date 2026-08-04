// studio-server.mjs — 디렉터 스튜디오 서버 (의존성 0)
// http://localhost:4900/ = 검수 UI. 정적 서빙 + 상태 API + 결정(승인/반려/골든ref) API.
// 모든 결정은 pipeline/events/events.jsonl에 append — 최신 이벤트가 이김 = 결정은 언제든 번복 가능.
import { createServer } from 'node:http'
import { readFileSync, existsSync, statSync, readdirSync, appendFileSync, copyFileSync, mkdirSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { networkInterfaces } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildState } from './studio-state.mjs'

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

const emit = (e) => {
  mkdirSync(path.dirname(EVENTS), { recursive: true })
  appendFileSync(EVENTS, JSON.stringify({ ts: new Date().toISOString(), ...e }) + '\n')
}

function state() {
  const s = buildState(ROOT)
  const ips = Object.values(networkInterfaces()).flat().filter(i => i && i.family === 'IPv4' && !i.internal).map(i => i.address)
  s.lanIp = ips.find(a => a.startsWith('192.168.')) || ips.find(a => a.startsWith('10.')) || ips[0] || null
  s.port = PORT
  return s
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
      // order는 숫자(에셋 발주) 또는 'texts'(텍스트 검수) — 이벤트 키는 `${order}/${item}`로 동일하게 동작
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
