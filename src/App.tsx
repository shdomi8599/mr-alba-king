import { useCallback, useState } from 'react'
import GameView from './game/GameView'
import { T } from './game/texts'
import type { Session } from './engine/session'

type Screen = 'title' | 'game' | 'over'

export default function App() {
  const [screen, setScreen] = useState<Screen>('title')
  const [last, setLast] = useState<Session | null>(null)
  const onGameOver = useCallback((s: Session) => {
    setLast(s)
    setScreen('over')
  }, [])

  if (screen === 'game') return <GameView onGameOver={onGameOver} />

  if (screen === 'over' && last)
    return (
      <div className="screen">
        <h1 className="over-title">{last.phase === 'complete' ? T('complete-title') : T('over-title')}</h1>
        {last.phase === 'complete' && <p className="tagline">{T('complete-sub')}</p>}
        <div className="score-label">{T('over-score')}</div>
        <div className="score-big">{last.score}</div>
        <div className="over-sub">
          {T('over-combo').replace('{n}', String(last.bestCombo))} · {T('over-level').replace('{n}', String(last.levelIndex + 1))}
        </div>
        <button className="cta" onClick={() => setScreen('game')}>
          {T('over-retry')}
        </button>
      </div>
    )

  return (
    <div className="screen">
      <h1 className="title">{T('title-name')}</h1>
      <p className="tagline">{T('title-tagline')}</p>
      <button className="cta" onClick={() => setScreen('game')}>
        {T('title-start')}
      </button>
    </div>
  )
}
