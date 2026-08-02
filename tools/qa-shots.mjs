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

// 4~9. 나머지 테마 스윕 — 플레이 상태 + 상호작용 재현
// 논리→뷰포트: scale 0.583, offsetY 77 (420×900 기준)
const L = (x, y) => [x * 0.583, 77 + y * 0.583]
const sweep = [
  { name: 'qa-sushi', round: 3, acts: [] },
  { name: 'qa-box-tap', round: 4, acts: async () => {
      // 박스 3연타 → 비행 연출 중 캡처 (박스 위치는 랜덤이라 넓게 여러 곳 탭)
      for (const [x, y] of [[210, 560], [160, 620], [260, 580], [210, 640]]) { await page.mouse.click(x, y); await page.waitForTimeout(90) }
    } },
  { name: 'qa-cvs', round: 5, acts: [] },
  { name: 'qa-chicken', round: 6, acts: [] },
  { name: 'qa-wash-scrub', round: 8, acts: async () => {
      const [sx, sy] = L(200, 640)
      await page.mouse.move(sx, sy)
      await page.mouse.down()
      for (let i = 0; i < 10; i++) { await page.mouse.move(sx + (i % 2 ? 90 : -90), sy + i * 6, { steps: 4 }); await page.waitForTimeout(40) }
    } },
  { name: 'qa-fish', round: 9, acts: [] },
  { name: 'qa-song-shake', round: 10, acts: async () => {
      for (let i = 0; i < 5; i++) { await page.mouse.click(i % 2 ? 105 : 315, 690); await page.waitForTimeout(110) }
    } },
]
for (const s of sweep) {
  await page.goto(BASE + `/?shot=game&round=${s.round}`)
  await page.waitForTimeout(1500)
  if (typeof s.acts === 'function') await s.acts()
  await page.waitForTimeout(120)
  await page.screenshot({ path: path.join(OUT, `${s.name}.png`) })
}

await browser.close()
console.log('qa shots → tmp/qa/')
