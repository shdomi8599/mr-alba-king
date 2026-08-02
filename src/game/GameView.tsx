import { useCallback, useEffect, useRef, useState } from 'react'
import { createSession, pointerSession, tickSession, LIVES, ROUNDS_TOTAL, type Session } from '../engine/session'
import { currentZone } from '../engine/templates/timing'
import type { GuideStep, Level, PointerInput, Rect, ThemeId } from '../engine/types'
import { BG, PLACEHOLDER } from '../assets/registry'
import { T } from './texts'

const LW = 720
const LH = 1280
const FIXED = 1000 / 60
const GAUGE: Rect = { x: 80, y: 790, w: 560, h: 84 }

const INSTR: Record<ThemeId, string> = {
  sushi: 'instr-sushi',
  gimbap: 'instr-gimbap',
  cvs: 'instr-cvs',
  bakery: 'instr-bakery',
  cafe: 'instr-cafe',
  chicken: 'instr-chicken',
  fish: 'instr-fish',
  box: 'instr-box',
  wash: 'instr-wash',
  song: 'instr-song',
}
// 지시어 아래 한 줄 힌트 (가이드는 1라운드뿐이므로 새 조작/기믹 테마엔 힌트로 안내)
const HINT: Partial<Record<ThemeId, string>> = {
  sushi: 'hint-sushi',
  cvs: 'hint-cvs',
  bakery: 'hint-bakery',
  cafe: 'hint-cafe',
  chicken: 'hint-chicken',
  fish: 'hint-fish',
  box: 'hint-box',
  wash: 'hint-wash',
  song: 'hint-song',
}

function Ph({ id, x, y, w, h, cls = '' }: { id: string; x: number; y: number; w: number; h: number; cls?: string }) {
  const p = PLACEHOLDER[id] ?? { fill: '#888', stroke: '#555', shape: 'rect' as const }
  return (
    <div
      className={`ph ${cls}`}
      style={{ left: x, top: y, width: w, height: h, background: p.fill, borderColor: p.stroke, borderRadius: p.shape === 'ellipse' ? '50%' : 18 }}
    />
  )
}

// 1라운드 가이드 스텝별 스포트라이트 영역
function guideFocus(lv: Level, step: GuideStep): Rect | null {
  if (lv.template !== 'drag') return null
  if (step === 'order') return { x: 18, y: 106, w: 420, h: 84 }
  const rects: Rect[] =
    step === 'drag'
      ? lv.items.map(i => ({ x: i.home.x - i.size.x / 2, y: i.home.y - i.size.y / 2, w: i.size.x, h: i.size.y }))
      : lv.targets.map(t => t.rect)
  const x1 = Math.min(...rects.map(r => r.x)) - 24
  const y1 = Math.min(...rects.map(r => r.y)) - 24
  const x2 = Math.max(...rects.map(r => r.x + r.w)) + 24
  const y2 = Math.max(...rects.map(r => r.y + r.h)) + 24
  return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 }
}

export default function GameView({ onGameOver }: { onGameOver: (s: Session) => void }) {
  const [, force] = useState(0)
  const sRef = useRef<Session | null>(null)
  if (!sRef.current) sRef.current = createSession(Date.now() & 0xffffffff)
  const wrapRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(0.5)

  useEffect(() => {
    const el = wrapRef.current!
    const fit = () => setScale(Math.min(el.clientWidth / LW, el.clientHeight / LH))
    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    let raf = 0
    let last = performance.now()
    let acc = 0
    const loop = (now: number) => {
      acc += Math.min(now - last, 100)
      last = now
      const s = sRef.current!
      while (acc >= FIXED) {
        tickSession(s, FIXED)
        acc -= FIXED
      }
      if (s.phase === 'gameover' || s.phase === 'complete') {
        onGameOver(s)
        return
      }
      force(n => n + 1)
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [onGameOver])

  const toLogical = useCallback(
    (e: React.PointerEvent): { x: number; y: number } => {
      const rect = e.currentTarget.getBoundingClientRect()
      return { x: (e.clientX - rect.left) / scale, y: (e.clientY - rect.top) / scale }
    },
    [scale],
  )
  const pointer = (type: PointerInput['type']) => (e: React.PointerEvent) => {
    e.preventDefault()
    if (type === 'down') (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId)
    pointerSession(sRef.current!, { type, ...toLogical(e) })
  }

  const s = sRef.current
  const lv = s.level
  const guideStep = s.phase === 'play' && s.guide.length > 0 ? s.guide[0] : null
  const focus = guideStep ? guideFocus(lv, guideStep) : null
  const bubbleAbove = focus ? focus.y > 420 : false

  return (
    <div className="game-wrap" ref={wrapRef}>
      <div
        className="game-canvas"
        style={{ width: LW, height: LH, transform: `scale(${scale})`, background: BG[lv.bgSprite] ?? '#222' }}
        onPointerDown={pointer('down')}
        onPointerMove={pointer('move')}
        onPointerUp={pointer('up')}
        onPointerCancel={pointer('up')}
      >
        <div className="hud">
          <div className="lives">
            {'❤️'.repeat(s.lives)}
            {'🖤'.repeat(Math.max(0, LIVES - s.lives))}
          </div>
          <div className="round">
            {T('sys-round').replace('{n}', String(s.levelIndex + 1)).replace('{m}', String(ROUNDS_TOTAL))}
          </div>
          <div className="score">{s.score}</div>
        </div>
        <div className="timerbar">
          <i
            style={{
              width: `${Math.max(0, lv.timeRemain / lv.timeLimit) * 100}%`,
              background: lv.timeRemain < lv.timeLimit * 0.3 ? '#e5484d' : '#f5b942',
            }}
          />
        </div>
        {s.combo >= 2 && <div className="combo">{T('sys-combo').replace('{n}', String(s.combo))}</div>}

        {lv.template === 'drag' && (
          <>
            {lv.orderIds.length > 0 && (
              <div className="order">
                <span>{T('order-label')}</span>
                {lv.sequence
                  ? lv.orderIds.map((id, i) => (
                      <div key={`${id}-${i}`} className={`chipwrap ${i < lv.seqIdx ? 'used' : ''}`}>
                        <i style={{ background: PLACEHOLDER[id]?.fill ?? '#888', borderColor: PLACEHOLDER[id]?.stroke ?? '#555' }} />
                        <b>{i + 1}</b>
                      </div>
                    ))
                  : [...new Set(lv.orderIds)].map(id => {
                      const n = lv.orderIds.filter(x => x === id).length
                      return (
                        <div key={id} className="chipwrap">
                          <i style={{ background: PLACEHOLDER[id]?.fill ?? '#888', borderColor: PLACEHOLDER[id]?.stroke ?? '#555' }} />
                          {n > 1 && <b>×{n}</b>}
                        </div>
                      )
                    })}
              </div>
            )}
            {lv.targets.map((t, i) => (
              <div key={i}>
                <div className="target" style={{ left: t.rect.x - 10, top: t.rect.y - 10, width: t.rect.w + 20, height: t.rect.h + 20 }} />
                <Ph id={t.sprite} x={t.rect.x} y={t.rect.y} w={t.rect.w} h={t.rect.h} />
                {t.wants && t.filled < t.capacity && (
                  <div
                    className="wantchip"
                    style={{
                      left: t.rect.x + t.rect.w / 2 - 19,
                      top: t.rect.y - 52,
                      background: PLACEHOLDER[t.wants]?.fill ?? '#888',
                      borderColor: PLACEHOLDER[t.wants]?.stroke ?? '#555',
                    }}
                  />
                )}
              </div>
            ))}
            {lv.items.map(it => (
              <Ph
                key={it.key}
                id={it.id}
                x={it.pos.x - it.size.x / 2}
                y={it.pos.y - it.size.y / 2}
                w={it.size.x}
                h={it.size.y}
                cls={it.held ? 'held' : it.done ? 'done' : ''}
              />
            ))}
          </>
        )}

        {lv.template === 'timing' && (
          <>
            {lv.deco.map(d => (
              <Ph key={d.id} id={d.id} x={d.rect.x} y={d.rect.y} w={d.rect.w} h={d.rect.h} />
            ))}
            <div className="reps">
              {lv.done} / {lv.reps}
            </div>
            <div className="gauge" style={{ left: GAUGE.x, top: GAUGE.y, width: GAUGE.w, height: GAUGE.h }}>
              <div
                className="zone"
                style={{
                  left: `${currentZone(lv).start * 100}%`,
                  width: `${(currentZone(lv).end - currentZone(lv).start) * 100}%`,
                }}
              />
              {lv.pattern === 'hold' && <div className="fill" style={{ width: `${lv.value * 100}%` }} />}
              <div className="marker" style={{ left: `calc(${lv.value * 100}% - 4px)` }} />
            </div>
          </>
        )}

        {lv.template === 'mash' && (
          <>
            {lv.deco.map(d => (
              <Ph key={d.id} id={d.id} x={d.rect.x} y={d.rect.y} w={d.rect.w} h={d.rect.h} />
            ))}
            {lv.kind === 'tap' && (
              <>
                <div className="reps">
                  {lv.count} / {lv.goal}
                </div>
                <Ph
                  id={lv.sprite}
                  x={lv.positions[lv.posIdx].x}
                  y={lv.positions[lv.posIdx].y}
                  w={lv.positions[lv.posIdx].w}
                  h={lv.positions[lv.posIdx].h}
                  cls="tapme"
                />
              </>
            )}
            {lv.kind === 'scrub' &&
              lv.blobs.map(
                (b, i) =>
                  b.hp > 0 && (
                    <div
                      key={i}
                      className="foam"
                      style={{
                        left: b.x - b.r,
                        top: b.y - b.r,
                        width: b.r * 2,
                        height: b.r * 2,
                        opacity: 0.35 + 0.65 * (b.hp / b.maxHp),
                      }}
                    />
                  ),
              )}
            {lv.kind === 'shake' && (
              <>
                <div className="gauge" style={{ left: GAUGE.x, top: GAUGE.y, width: GAUGE.w, height: GAUGE.h }}>
                  <div className="fill" style={{ width: `${lv.gauge * 100}%` }} />
                </div>
                <div className={`side sideL ${lv.lastSide !== 'L' ? 'on' : ''}`}>L</div>
                <div className={`side sideR ${lv.lastSide !== 'R' ? 'on' : ''}`}>R</div>
              </>
            )}
          </>
        )}

        {lv.penaltyT > 0 && <div className="penalty" />}

        {guideStep && focus && (
          <>
            <div className="guide-hole" style={{ left: focus.x, top: focus.y, width: focus.w, height: focus.h }} />
            <div className="guide-hand" style={{ left: focus.x + focus.w / 2 - 30, top: focus.y + focus.h - 16 }}>
              👆
            </div>
            <div className="guide-bubble" style={bubbleAbove ? { top: focus.y - 190 } : { top: focus.y + focus.h + 40 }}>
              {T(`tut-${guideStep}`)}
              <div className="tap">{T('tut-tap')}</div>
            </div>
          </>
        )}

        {s.phase === 'instruct' && (
          <>
            <div className="instruct">{T(INSTR[lv.theme])}</div>
            {HINT[lv.theme] && <div className="instr-hint">{T(HINT[lv.theme]!)}</div>}
            {s.levelUpFlash && <div className="levelup">{T('sys-levelup')}</div>}
          </>
        )}
        {s.phase === 'result' && (
          <div className={`result ${s.lastResult ?? ''}`}>
            {s.lastResult === 'clear' ? (s.lastPerfect ? T('sys-perfect') : 'OK!') : T('sys-fail')}
          </div>
        )}
      </div>
    </div>
  )
}
