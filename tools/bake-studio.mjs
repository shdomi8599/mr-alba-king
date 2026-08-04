// bake-studio.mjs — 디렉터 스튜디오의 심사용 읽기 전용 스냅샷 생성
// 실데이터(이벤트·에셋·오디오·문서)를 정적 파일로 굽고, 게임 탭은 배포된 게임(../)을 임베드한다.
// 사용: node tools/bake-studio.mjs [outDir=dist/studio]  — 게임 빌드(dist) 뒤에 실행
import { readFileSync, writeFileSync, mkdirSync, readdirSync, copyFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildState } from './studio-state.mjs'

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const OUT = path.join(ROOT, process.argv[2] || path.join('dist', 'studio'))
mkdirSync(OUT, { recursive: true })

// 1) 상태 스냅샷 — URL을 상대 경로로, 게임 탭은 배포된 게임 본체로
const state = buildState(ROOT)
state.status.playUrl = '../' // 스튜디오의 🎮 게임 탭 = 배포된 게임
const json = JSON.stringify(state).replaceAll('"/pipeline/', '"pipeline/')
writeFileSync(path.join(OUT, 'state.json'), json)

// 2) UI — BAKED 플래그 주입
const html = readFileSync(path.join(ROOT, 'tools', 'studio', 'index.html'), 'utf8')
  .replace('</head>', '<script>window.__BAKED=1</script></head>')
writeFileSync(path.join(OUT, 'index.html'), html)

// 3) 참조 파일 복사 — 스테이징 에셋/오디오/캡처 + 문서
const copyDir = (relSrc, exts) => {
  const src = path.join(ROOT, relSrc)
  if (!existsSync(src)) return 0
  const dest = path.join(OUT, relSrc)
  mkdirSync(dest, { recursive: true })
  let n = 0
  for (const f of readdirSync(src)) {
    if (exts && !exts.some(e => f.endsWith(e))) continue
    const s = path.join(src, f)
    if (!existsSync(s) || !readdirSync(path.dirname(s)).includes(f)) continue
    try {
      copyFileSync(s, path.join(dest, f))
      n++
    } catch {}
  }
  return n
}
const nAssets = copyDir(path.join('pipeline', 'staging', 'assets'), ['.png'])
const nAudio = copyDir(path.join('pipeline', 'staging', 'audio'), ['.ogg'])
const nShots = copyDir(path.join('pipeline', 'staging', 'shots'), ['.png'])
mkdirSync(path.join(OUT, 'docs'), { recursive: true })
let nDocs = 0
for (const f of readdirSync(path.join(ROOT, 'docs'))) {
  if (!f.endsWith('.md')) continue
  copyFileSync(path.join(ROOT, 'docs', f), path.join(OUT, 'docs', f))
  nDocs++
}
console.log(`studio snapshot → ${path.relative(ROOT, OUT)} (assets ${nAssets} · audio ${nAudio} · shots ${nShots} · docs ${nDocs})`)
