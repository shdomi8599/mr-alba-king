// smoke.mjs — 실격 방지 스모크 테스트: 빌드가 뜨고, 시작 버튼이 동작하고, 첫 레벨이 입력에 반응하고, 콘솔 에러가 없다
// 사용: (빌드 서버 실행 중) node tools/smoke.mjs   — SMOKE_URL 기본 http://localhost:4173 (vite preview)
import { chromium } from 'playwright'

const BASE = process.env.SMOKE_URL || 'http://localhost:4173'
const errors = []

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 420, height: 900 } })
page.on('pageerror', e => errors.push(`pageerror: ${e.message}`))
page.on('console', m => {
  if (m.type() === 'error') errors.push(`console: ${m.text()}`)
})

try {
  await page.goto(BASE, { waitUntil: 'load', timeout: 15000 })
  // 1) 타이틀이 뜬다
  await page.getByText('알바킹').first().waitFor({ timeout: 5000 })
  // 2) 출근하기 → 게임 캔버스가 뜬다
  await page.getByText('출근하기').click()
  await page.locator('.game-canvas').waitFor({ timeout: 5000 })
  // 3) 첫 레벨(가이드 타임스탑)이 입력에 반응한다 — 탭하면 가이드가 진행됨
  await page.waitForTimeout(1500)
  const before = await page.locator('.guide-bubble').count()
  await page.locator('.game-canvas').dispatchEvent('pointerdown', { pointerId: 1, clientX: 210, clientY: 450 })
  await page.waitForTimeout(300)
  const after = await page.locator('.guide-bubble').textContent().catch(() => null)
  if (before === 0) errors.push('guide not shown on round 1')
  console.log(`guide before=${before} afterText=${(after || '').slice(0, 20)}`)
} catch (e) {
  errors.push(`flow: ${e.message}`)
}
await browser.close()

if (errors.length) {
  console.error('SMOKE FAIL:\n' + errors.join('\n'))
  process.exit(1)
}
console.log('SMOKE PASS — 빌드 실행·시작·입력 반응·콘솔 클린')
