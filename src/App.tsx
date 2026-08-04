import { useCallback, useEffect, useState } from 'react'
import GameView from './game/GameView'
import { T } from './game/texts'
import { makeEval } from './game/evaluate'
import { playSfx, startBgm } from './game/sound'
import { spriteUrl } from './assets/registry'
import type { Session } from './engine/session'

type Screen = 'title' | 'game' | 'over'

// 실아트 버튼 — 완성형 통짜 버튼(ui-button-full)을 원본 비율 그대로, 글자만 코드로 (9-slice 기각: 질감 소실)
function Cta({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  const u = spriteUrl('ui-button-full')
  const click = () => {
    playSfx('sfx-tap') // 버튼 피드백 — 시작 인지
    onClick()
  }
  return (
    <button className={`cta ${u ? 'cta-full' : ''}`} style={u ? { backgroundImage: `url(${u})` } : undefined} onClick={click}>
      {children}
    </button>
  )
}

// 캡처·QA 전용 진입 파라미터 (?shot=over|game) — 스튜디오 텍스트 검수용 상황 캡처(shots) 촬영에 사용
const shotParam = new URLSearchParams(window.location.search).get('shot')
const mockOverSession = (): Session =>
  ({
    phase: 'gameover',
    score: 4520,
    bestCombo: 9,
    levelIndex: 17,
    lives: 0,
    telemetry: {
      sushi: { tries: 3, clears: 3, perfects: 2 },
      gimbap: { tries: 2, clears: 2, perfects: 1 },
      chicken: { tries: 2, clears: 0, perfects: 0 },
    },
  }) as unknown as Session

export default function App() {
  const [screen, setScreen] = useState<Screen>(shotParam === 'over' ? 'over' : shotParam === 'game' ? 'game' : 'title')
  const [last, setLast] = useState<Session | null>(shotParam === 'over' ? mockOverSession() : null)
  const onGameOver = useCallback((s: Session) => {
    setLast(s)
    setScreen('over')
  }, [])

  // 타이틀 BGM(낙선 후보 재활용 트랙) — 자동재생 정책상 제스처 전엔 차단: 즉시 시도 + 첫 탭에서 시작.
  // 출근하기 → 인게임은 별도 트랙(bgm-main)으로 전환된다.
  useEffect(() => {
    if (screen !== 'title') return
    startBgm('bgm-title')
    const once = () => startBgm('bgm-title')
    window.addEventListener('pointerdown', once, { once: true })
    return () => window.removeEventListener('pointerdown', once)
  }, [screen])

  if (screen === 'game') return <GameView onGameOver={onGameOver} />

  if (screen === 'over' && last) {
    const report = makeEval(last)
    const bossUrl = spriteUrl(report.grade === 's' || report.grade === 'a' ? 'ui-boss-happy' : 'ui-boss-angry')
    const complete = last.phase === 'complete'
    const panelUrl = spriteUrl('ui-panel')
    const bgUrl = spriteUrl('title-bg')
    return (
      <div className="screen over-screen" style={bgUrl ? { backgroundImage: `url(${bgUrl})` } : undefined}>
        <div className={`evalpanel ${panelUrl ? 'framed' : ''}`} style={panelUrl ? { backgroundImage: `url(${panelUrl})` } : undefined}>
          <h1 className="over-title">{complete ? T('complete-title') : T('over-title')}</h1>
          {complete && <p className="tagline">{T('complete-sub')}</p>}
          {bossUrl ? <img className="boss" src={bossUrl} alt="" /> : <div className="boss boss-fallback">👨‍🍳</div>}
          <div className="eval-lines">
            {report.lines.map((l, i) => (
              <p key={i}>“{l}”</p>
            ))}
          </div>
          <div className="score-row">
            <div>
              <div className="score-label">{T('over-score')}</div>
              <div className="score-big">{last.score}</div>
            </div>
            <div className="over-sub">
              {T('over-combo').replace('{n}', String(last.bestCombo))}
              <br />
              {T('over-level').replace('{n}', String(last.levelIndex + 1))}
            </div>
          </div>
        </div>
        <Cta onClick={() => setScreen('game')}>{T('over-retry')}</Cta>
      </div>
    )
  }

  const titleBg = spriteUrl('title-bg')
  const logo = spriteUrl('logo-symbol')
  return (
    <div className="screen title-screen" style={titleBg ? { backgroundImage: `url(${titleBg})` } : undefined}>
      <div className="title-center">
        {logo && <img className="title-logo" src={logo} alt="" />}
        <h1 className="title">{T('title-name')}</h1>
        <p className="tagline">{T('title-tagline')}</p>
        <Cta onClick={() => setScreen('game')}>{T('title-start')}</Cta>
      </div>
    </div>
  )
}
