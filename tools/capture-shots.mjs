// capture-shots.mjs — 상황 캡처 자동화: 게임 화면을 찍어 스튜디오 텍스트 검수(shots)에 연결
// 사용: pnpm dev 실행 중에  node tools/capture-shots.mjs   (SHOT_BASE로 대상 변경 가능)
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const BASE = process.env.SHOT_BASE || 'http://localhost:5173'
const OUT = path.join(ROOT, 'pipeline', 'staging', 'shots')
mkdirSync(OUT, { recursive: true })

const SHOTS = [
  { name: 'screen-title', url: '/', wait: 1000 },
  { name: 'screen-over', url: '/?shot=over', wait: 800 },
  { name: 'screen-guide', url: '/?shot=game', wait: 2000 }, // 1라운드 가이드 타임스탑 상태
]

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 420, height: 900 } })
for (const s of SHOTS) {
  await page.goto(BASE + s.url)
  await page.waitForTimeout(s.wait)
  await page.screenshot({ path: path.join(OUT, `${s.name}.png`) })
  console.log(`✓ ${s.name}.png`)
}
await browser.close()
console.log('done → 스튜디오 ✏️ 텍스트 탭에서 캡처와 함께 검수')
