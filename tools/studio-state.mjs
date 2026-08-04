// studio-state.mjs — 스튜디오 상태 빌더 (서버·정적 스냅샷 공용)
import { readFileSync, existsSync, readdirSync } from 'node:fs'
import { execSync } from 'node:child_process'
import path from 'node:path'

export function buildState(ROOT) {
  const EVENTS = path.join(ROOT, 'pipeline', 'events', 'events.jsonl')
  const REF = path.join(ROOT, 'pipeline', 'refs', 'style-ref.png')
  const readEvents = () => {
    if (!existsSync(EVENTS)) return []
    return readFileSync(EVENTS, 'utf8').split('\n').filter(Boolean).map(l => { try { return JSON.parse(l) } catch { return null } }).filter(Boolean)
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

  // 매니페스트 슬롯 상태 파생 — 슬롯 id ↔ 발주 아이템 id 자동 매칭 (명시 source > 정확 일치 > 접두사(BGM 후보), 승인본 우선)
  const itemIndex = {}
  const byId = {}
  for (const o of orders)
    for (const it of o.items) {
      itemIndex[`${o.order}/${it.id}`] = it
      ;(byId[it.id] = byId[it.id] || []).push(it)
    }
  const pick = cands => {
    if (!cands || !cands.length) return null
    return cands.find(c => c.isGolden) || cands.find(c => c.status === 'approved') || cands[cands.length - 1]
  }
  const manifest = readJson('manifest.json', { categories: [] })
  for (const cat of manifest.categories || []) {
    for (const slot of cat.slots || []) {
      let it = slot.source ? itemIndex[`${slot.source.order}/${slot.source.item}`] : null
      if (!it) it = pick(byId[slot.id])
      if (!it) {
        const prefixed = Object.keys(byId).filter(id => id.startsWith(slot.id + '-')).flatMap(id => byId[id])
        it = pick(prefixed)
      }
      if (it) {
        slot.status = it.isGolden ? 'golden' : it.status
        slot.url = it.exists ? it.url : null
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

  // 텍스트: texts.json + 결정 상태 파생 (order:'texts') + 상황 캡처 존재 확인
  const texts = readJson('texts.json', { categories: [] })
  for (const cat of texts.categories || []) {
    for (const t of cat.entries || []) {
      const d = latest[`texts/${t.id}`]
      t.status = d ? d.event : 'pending'
      t.reason = d?.reason || null
      const shotFile = t.shot || `${t.id}.png`
      const shotPath = path.join(ROOT, 'pipeline', 'staging', 'shots', shotFile)
      t.shotUrl = existsSync(shotPath) ? `/pipeline/staging/shots/${shotFile}` : null
    }
  }

  // lanIp/port는 서버 전용 — 서버가 buildState 결과에 덧붙인다
  return {
    goldenRef: golden ? { ...golden, exists: existsSync(REF) } : null,
    orders, audio: scanAudio(''), docs, counts, events: events.slice(-60).reverse(),
    criteria, status, manifest, gitLog, threads, texts, lanIp: null, port: null,
  }
}
