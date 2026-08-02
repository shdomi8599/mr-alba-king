import { useCallback, useEffect, useRef, useState } from 'react'
import { createSession, pointerSession, tickSession, LIVES, type Session } from '../engine/session'
import type { PointerInput, ThemeId } from '../engine/types'
import { BG, PLACEHOLDER } from '../assets/registry'
import { T } from './texts'

const LW = 720
const LH = 1280
const FIXED = 1000 / 60

const INSTR: Record<ThemeId, string> = { sushi: 'instr-sushi', gimbap: 'instr-gimbap', cvs: 'instr-cvs' }

function Ph({ id, x, y, w, h, cls = '' }: { id: string; x: number; y: number; w: number; h: number; cls?: string }) {
  const p = PLACEHOLDER[id] ?? { fill: '#888', stroke: '#555', shape: 'rect' as const }
  return (
    <div
      className={`ph ${cls}`}
      style={{ left: x, top: y, width: w, height: h, background: p.fill, borderColor: p.stroke, borderRadius: p.shape === 'ellipse' ? '50%' : 18 }}
    />
  )
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
      if (s.phase === 'gameover') {
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

        {lv.deco.map(d => (
          <Ph key={d.id} id={d.id} x={d.rect.x} y={d.rect.y} w={d.rect.w} h={d.rect.h} />
        ))}
        <div className="target" style={{ left: lv.target.x - 12, top: lv.target.y - 12, width: lv.target.w + 24, height: lv.target.h + 24 }} />
        <Ph id={lv.targetSprite} x={lv.target.x} y={lv.target.y} w={lv.target.w} h={lv.target.h} />
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

        {s.phase === 'instruct' && (
          <>
            <div className="instruct">{T(INSTR[lv.theme])}</div>
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
