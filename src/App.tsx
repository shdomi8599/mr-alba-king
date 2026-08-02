import { useCallback, useState } from 'react'
import GameView from './game/GameView'
import { T } from './game/texts'
import { makeEval } from './game/evaluate'
import { spriteUrl } from './assets/registry'
import credits from './game/credits.json'
import type { Session } from './engine/session'

type Screen = 'title' | 'game' | 'over'

const fill = (id: string, vars: Record<string, number>): string =>
  Object.entries(vars).reduce((s, [k, v]) => s.replace(`{${k}}`, v.toLocaleString()), T(id))

export default function App() {
  const [screen, setScreen] = useState<Screen>('title')
  const [last, setLast] = useState<Session | null>(null)
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
          <div className="staffroll">
            <div className="staff-title">{T('credits-title')}</div>
            <div>{fill('credit-art', { made: credits.made, rejected: credits.rejected })}</div>
            <div>{fill('credit-qa', { sessions: credits.sessions, levels: credits.levels })}</div>
            <div>{fill('credit-code', { commits: credits.commits })}</div>
          </div>
        </div>
        <button className="cta" onClick={() => setScreen('game')}>
          {T('over-retry')}
        </button>
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
        <button className="cta" onClick={() => setScreen('game')}>
          {T('title-start')}
        </button>
      </div>
    </div>
  )
}
