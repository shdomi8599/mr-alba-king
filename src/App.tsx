import { useCallback, useEffect, useState } from 'react'
import GameView from './game/GameView'
import { T } from './game/texts'
import { makeEval } from './game/evaluate'
import { playSfx, startBgm } from './game/sound'
import { spriteUrl } from './assets/registry'
import { preloadFirstRound, preloadRest, preloadTitle } from './assets/preload'
import { THEME_ORDER } from './engine/levels'
import type { Session } from './engine/session'

type Screen = 'title' | 'game' | 'over'

// 실아트 버튼 — 완성형 통짜 버튼(ui-button-full)을 원본 비율 그대로, 글자만 코드로 (9-slice 기각: 질감 소실)
function Cta({ onClick, children, disabled }: { onClick: () => void; children: React.ReactNode; disabled?: boolean }) {
  const u = spriteUrl('ui-button-full')
  const click = () => {
    playSfx('sfx-tap') // 버튼 피드백 — 시작 인지
    onClick()
  }
  return (
    <button
      className={`cta ${u ? 'cta-full' : ''} ${disabled ? 'cta-wait' : ''}`}
      style={u ? { backgroundImage: `url(${u})` } : undefined}
      onClick={click}
      disabled={disabled}
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
  // 부팅 게이트: 공용 UI + 1라운드 에셋을 먼저 받아둔다. 전체를 기다리면 저속 회선에서 너무 오래 잡힌다.
  const [booted, setBooted] = useState(false)
  const [startReady, setStartReady] = useState(false)
  const [startRatio, setStartRatio] = useState(0)
  const onGameOver = useCallback((s: Session) => {
    setLast(s)
    setScreen('over')
  }, [])

  useEffect(() => {
    let alive = true
    const t0 = performance.now()
    // 1단계: 타이틀 화면 에셋만 기다린다(게임오버용 사장님·평가지까지 물리면 첫 화면이 그만큼 늦어진다)
    preloadTitle().then(() => {
      // 최소 노출 400ms — 빠른 회선에서 로딩 화면이 '깜빡'하지 않고 의도된 연출로 읽히게
      const wait = Math.max(0, 400 - (performance.now() - t0))
      setTimeout(() => {
        if (!alive) return
        setBooted(true)
        // 2단계: 타이틀을 보는 동안 1라운드 에셋 확보 → 끝나면 시작 버튼 해제, 이어서 나머지 선반입
        preloadFirstRound(THEME_ORDER[0], r => alive && setStartRatio(r)).then(() => {
          if (!alive) return
          setStartReady(true)
          preloadRest(THEME_ORDER)
        })
      }, wait)
    })
    return () => {
      alive = false
    }
  }, [])

  // 타이틀이 실제로 커밋된 뒤에 스플래시를 걷는다(먼저 걷으면 한 프레임 빈 화면이 보인다)
  useEffect(() => {
    if (booted) document.getElementById('boot')?.remove()
  }, [booted])

  // 타이틀 BGM(낙선 후보 재활용 트랙) — 자동재생 정책상 제스처 전엔 차단: 즉시 시도 + 첫 탭에서 시작.
  // 출근하기 → 인게임은 별도 트랙(bgm-main)으로 전환된다.
  // startReady 이후에만 시작한다: BGM 1곡이 600KB대라 임계 경로에서 이미지와 대역폭을 다투면
  // 저속 회선에서 첫 화면이 수 초 밀린다(어차피 제스처 전엔 소리도 안 난다).
  useEffect(() => {
    if (screen !== 'title' || !startReady) return
    startBgm('bgm-title')
    const once = () => startBgm('bgm-title')
    window.addEventListener('pointerdown', once, { once: true })
    return () => window.removeEventListener('pointerdown', once)
  }, [screen, startReady])

  // 타이틀 에셋이 준비되기 전엔 index.html의 스플래시(#boot)가 화면을 덮고 있다 — 여기선 아무것도 그리지 않는다
  if (!booted) return null

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
        <Cta onClick={() => setScreen('game')} disabled={!startReady}>
          {startReady ? T('title-start') : `${T('boot-loading')} ${Math.round(startRatio * 100)}%`}
        </Cta>
      </div>
    </div>
  )
}
