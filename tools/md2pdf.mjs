// md2pdf.mjs — 제출용 PDF 생성 (Playwright 크로미엄 인쇄, 무의존)
// 사용: node tools/md2pdf.mjs docs/TECH-DOC.md docs/INTRO-DOC.md  → docs/pdf/*.pdf
import { chromium } from 'playwright'
import { readFileSync, mkdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const OUT = path.join(ROOT, 'docs', 'pdf')
mkdirSync(OUT, { recursive: true })

// 미니 마크다운 → HTML (스튜디오 렌더러와 동일 계열)
function md(src) {
  const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const inline = s =>
    esc(s)
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
  const lines = src.split('\n')
  const out = []
  let i = 0, inCode = false, codeBuf = []
  while (i < lines.length) {
    const l = lines[i]
    if (l.startsWith('```')) {
      if (inCode) { out.push(`<pre><code>${esc(codeBuf.join('\n'))}</code></pre>`); codeBuf = [] }
      inCode = !inCode; i++; continue
    }
    if (inCode) { codeBuf.push(l); i++; continue }
    if (/^\s*$/.test(l)) { i++; continue }
    if (/^#{1,4} /.test(l)) { const n = l.match(/^#+/)[0].length; out.push(`<h${n}>${inline(l.replace(/^#+ /, ''))}</h${n}>`); i++; continue }
    if (/^---+$/.test(l.trim())) { out.push('<hr>'); i++; continue }
    if (/^> /.test(l)) { const b = []; while (i < lines.length && /^> ?/.test(lines[i])) b.push(lines[i++].replace(/^> ?/, '')); out.push(`<blockquote>${b.map(inline).join('<br>')}</blockquote>`); continue }
    if (/^\|/.test(l)) {
      const rows = []; while (i < lines.length && /^\|/.test(lines[i])) rows.push(lines[i++])
      const parse = r => r.split('|').slice(1, -1).map(c => c.trim())
      const head = parse(rows[0]); const body = rows.slice(2).map(parse)
      out.push(`<table><tr>${head.map(h => `<th>${inline(h)}</th>`).join('')}</tr>${body.map(r => `<tr>${r.map(c => `<td>${inline(c)}</td>`).join('')}</tr>`).join('')}</table>`)
      continue
    }
    if (/^[-*] /.test(l) || /^\d+\. /.test(l)) {
      const items = []; while (i < lines.length && (/^[-*] /.test(lines[i]) || /^\d+\. /.test(lines[i]))) items.push(lines[i++].replace(/^([-*]|\d+\.) /, ''))
      out.push(`<ul>${items.map(x => `<li>${inline(x)}</li>`).join('')}</ul>`)
      continue
    }
    out.push(`<p>${inline(l)}</p>`); i++
  }
  return out.join('\n')
}

const CSS = `
  * { box-sizing: border-box; }
  body { font-family: 'Malgun Gothic', 'Pretendard', sans-serif; color: #1d1a16; font-size: 10.5pt; line-height: 1.62; margin: 0; }
  h1 { font-size: 19pt; color: #8a5a10; border-bottom: 3px solid #f5b942; padding-bottom: 6px; margin: 0 0 10px; }
  h2 { font-size: 13.5pt; margin: 18px 0 6px; color: #3a2c14; border-left: 5px solid #f5b942; padding-left: 8px; }
  h3 { font-size: 11.5pt; margin: 12px 0 4px; }
  p { margin: 5px 0; }
  ul { margin: 4px 0; padding-left: 20px; }
  li { margin: 3px 0; }
  code { background: #f4efe4; padding: 1px 5px; border-radius: 4px; font-size: 9pt; }
  pre { background: #f8f4ea; border: 1px solid #e0d6bc; border-radius: 8px; padding: 10px; font-size: 8.5pt; overflow: hidden; white-space: pre-wrap; }
  table { border-collapse: collapse; width: 100%; margin: 8px 0; font-size: 9.5pt; }
  th, td { border: 1px solid #d8cdb2; padding: 5px 8px; text-align: left; vertical-align: top; }
  th { background: #f8f0da; }
  blockquote { border-left: 4px solid #f5b942; background: #fdf8ec; margin: 8px 0; padding: 8px 14px; border-radius: 0 8px 8px 0; }
  hr { border: none; border-top: 1px solid #d8cdb2; margin: 14px 0; }
  a { color: #8a5a10; }
`

const browser = await chromium.launch()
const page = await browser.newPage()
for (const rel of process.argv.slice(2)) {
  const src = readFileSync(path.join(ROOT, rel), 'utf8')
  const html = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><style>${CSS}</style></head><body>${md(src)}</body></html>`
  await page.setContent(html, { waitUntil: 'load' })
  const name = path.basename(rel, '.md') + '.pdf'
  await page.pdf({ path: path.join(OUT, name), format: 'A4', margin: { top: '16mm', bottom: '16mm', left: '15mm', right: '15mm' }, printBackground: true })
  console.log('✓', name)
}
await browser.close()
