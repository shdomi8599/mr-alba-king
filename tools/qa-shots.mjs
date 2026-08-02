// qa-shots.mjs — 자가 검수 스크린샷: UI·이펙트 변경 후 눈으로 확인하기 위한 도구
// 사용: (pnpm dev 실행 중) node tools/qa-shots.mjs   → tmp/qa/*.png
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const OUT = path.join(ROOT, 'tmp', 'qa')
mkdirSync(OUT, { recursive: true })
const BASE = process.env.SHOT_BASE || 'http://localhost:5173'

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 420, height: 900 } })

// 1. 타이틀 (버튼 9-slice)
await page.goto(BASE + '/')
await page.waitForTimeout(1000)
await page.screenshot({ path: path.join(OUT, 'qa-title.png') })

// 2. 1라운드 — 가이드 3탭 해제 후 (주문표 티켓 + 타이머 프레임)
await page.goto(BASE + '/?shot=game')
await page.waitForTimeout(1800)
for (let i = 0; i < 3; i++) {
  await page.mouse.click(210, 400)
  await page.waitForTimeout(250)
}
await page.waitForTimeout(300)
await page.screenshot({ path: path.join(OUT, 'qa-round1.png') })

// 3. 카페(2라운드) — 홀드 중 (주전자 기울임 + 물줄기 + 컵 채움)
await page.goto(BASE + '/?shot=game&round=2')
await page.waitForTimeout(1500)
await page.mouse.move(210, 640)
await page.mouse.down()
await page.waitForTimeout(850)
await page.screenshot({ path: path.join(OUT, 'qa-cafe-hold.png') })
await page.mouse.up()

await browser.close()
console.log('qa shots → tmp/qa/')
