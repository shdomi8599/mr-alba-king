import { useCallback, useState } from 'react'
import GameView from './game/GameView'
import { T } from './game/texts'
import { makeEval } from './game/evaluate'
import { spriteUrl } from './assets/registry'
import type { Session } from './engine/session'

type Screen = 'title' | 'game' | 'over'

// 실아트 버튼 — ui-button-frame(트림본)을 border-image 9-slice로: 모서리는 원본 비율 유지, 중앙만 늘어남
function Cta({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  const u = spriteUrl('ui-button-frame')
  return (
    <button
      className={`cta ${u ? 'cta-img' : ''}`}
      style={u ? { borderImageSource: `url(${u})`, borderImageSlice: '110 fill', borderImageWidth: '27px', borderImageRepeat: 'stretch' } : undefined}
      onClick={onClick}
    >
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

  if (screen === 'game') return <GameView onGameOver={onGameOver} />

  if (screen === 'over' && last) {
    const report = makeEval(last)
    const bossUrl = spriteUrl(report.grade === 's' || report.grade === 'a' ? 'ui-boss-happy' : 'ui-boss-angry')
    const complete = last.phase === 'complete'
    return (
      <div className="screen over-screen">
        <div className="evalpanel">
          <h1 className="over-title">{complete ? T('complete-title') : T('over-title')}</h1>
          {complete && <p className="tagline">{T('complete-sub')}</p>}
          <div className="eval-body">
            {bossUrl ? <img className="boss" src={bossUrl} alt="" /> : <div className="boss boss-fallback">👨‍🍳</div>}
            <div className="eval-lines">
              {report.lines.map((l, i) => (
                <p key={i}>“{l}”</p>
              ))}
            </div>
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
