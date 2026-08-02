// gen-credits.mjs — AI 협업 실측값 생성 (정직 표기 원칙: 숫자는 전부 이벤트 스토어·git에서)
// 게임 내 노출은 제거됨(ADR-011) — 기술 문서·영상 엔딩의 숫자 소스로만 사용. 출력: pipeline/credits.json
import { readFileSync, writeFileSync } from 'node:fs'
import { execSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const events = readFileSync(path.join(ROOT, 'pipeline', 'events', 'events.jsonl'), 'utf8')
  .split('\n')
  .filter(Boolean)
  .map(l => JSON.parse(l))

const distinct = ev => new Set(events.filter(e => e.event === ev && typeof e.order === 'number').map(e => `${e.order}/${e.item}`)).size
const made = distinct('generated')
const rejected = distinct('rejected')
const qa = [...events].reverse().find(e => e.event === 'qa-run') ?? { sessions: 0, levelAttempts: 0 }
let commits = 0
try {
  commits = Number(execSync('git rev-list --count HEAD', { cwd: ROOT, encoding: 'utf8' }).trim())
} catch {}

const credits = { made, rejected, sessions: qa.sessions, levels: qa.levelAttempts, commits }
writeFileSync(path.join(ROOT, 'pipeline', 'credits.json'), JSON.stringify(credits, null, 2) + '\n')
console.log('credits:', JSON.stringify(credits))
