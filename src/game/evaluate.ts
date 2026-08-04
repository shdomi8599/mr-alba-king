// 사장님 평가서 — 폴백 뱅크 (ADR-002 1단계): 텔레메트리를 규칙으로 조립. P6 2단계에서 LLM이 같은 입력을 받는다.
import type { Session } from '../engine/session'
import type { ThemeId } from '../engine/types'
import { T } from './texts'

export type Grade = 's' | 'a' | 'b' | 'c'

export type EvalReport = {
  grade: Grade
  lines: string[]
}

export function makeEval(s: Session): EvalReport {
  const grade: Grade = s.phase === 'complete' ? 's' : s.levelIndex >= 20 ? 'a' : s.levelIndex >= 10 ? 'b' : 'c'
  // 총평 변형 중 랜덤 선택 — 빌드타임 AI 작성 뱅크 (ADR-010: 런타임 LLM 배제)
  const variants = [`eval-grade-${grade}`, `eval-grade-${grade}-2`].filter(id => !T(id).startsWith('eval-'))
  const lines: string[] = [T(variants[Math.floor(Math.random() * variants.length)] ?? `eval-grade-${grade}`)]

  const entries = (Object.entries(s.telemetry) as [ThemeId, { tries: number; clears: number; perfects: number }][]).filter(
    ([, t]) => t.tries >= 2,
  )
  if (entries.length >= 2) {
    const byRate = [...entries].sort((a, b) => b[1].clears / b[1].tries - a[1].clears / a[1].tries)
    const best = byRate[0]
    const worst = byRate[byRate.length - 1]
    if (best[1].clears / best[1].tries > 0.5) {
      lines.push(T('eval-best').replace('{theme}', T(`theme-${best[0]}`)))
    }
    if (worst[0] !== best[0] && worst[1].clears / worst[1].tries < 0.7) {
      lines.push(T('eval-worst').replace('{theme}', T(`theme-${worst[0]}`)))
    }
  }

  const perfects = Object.values(s.telemetry).reduce((n, t) => n + t.perfects, 0)
  if (perfects >= 3) lines.push(T('eval-perfect').replace('{n}', String(perfects)))
  else if (s.bestCombo >= 8) lines.push(T('eval-combo').replace('{n}', String(s.bestCombo)))

  return { grade, lines: lines.slice(0, 3) } // 멘트 과다 방지 — 총평 + 최대 2개 (레이아웃 안정)
}
