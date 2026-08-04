import { useCallback, useEffect, useRef, useState } from 'react'
import { createSession, difficultyOf, pointerSession, tickSession, LIVES, ROUNDS_TOTAL, type Session } from '../engine/session'
import { makeLevel, THEME_ORDER } from '../engine/levels'
import { currentZone } from '../engine/templates/timing'
import { playSfx, startBgm, startLoopSfx, stopBgm, stopLoopSfx } from './sound'
import type { GuideStep, Level, PointerInput, Rect, ThemeId } from '../engine/types'
import { BG, PLACEHOLDER, spriteUrl } from '../assets/registry'
import { T } from './texts'

const LW = 720
const LH = 1280
const FIXED = 1000 / 60
const GAUGE: Rect = { x: 80, y: 920, w: 560, h: 84 } // 작업 표면 밴드 하단 — 소품(컵/솥/틀)이 위에 놓임

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

// 스프라이트: 승격된 실아트(PNG)가 있으면 이미지, 없으면 SVG 대역(색 도형)
function Ph({ id, x, y, w, h, cls = '' }: { id: string; x: number; y: number; w: number; h: number; cls?: string }) {
  const url = spriteUrl(id)
  if (url) {
    return <img className={`ph-img ${cls}`} src={url} alt="" draggable={false} style={{ left: x, top: y, width: w, height: h }} />
  }
  const p = PLACEHOLDER[id] ?? { fill: '#888', stroke: '#555', shape: 'rect' as const }
  return (
    <div
      className={`ph ${cls}`}
      style={{ left: x, top: y, width: w, height: h, background: p.fill, borderColor: p.stroke, borderRadius: p.shape === 'ellipse' ? '50%' : 18 }}
    />
  )
}

// 주문표/매칭 칩: 실아트 미니 이미지 우선, 없으면 색 사각형
function Chip({ id }: { id: string }) {
  const url = spriteUrl(id)
  if (url) return <img className="chipimg" src={url} alt="" draggable={false} />
  return <i style={{ background: PLACEHOLDER[id]?.fill ?? '#888', borderColor: PLACEHOLDER[id]?.stroke ?? '#555' }} />
}

// 아이템 이름표 — texts.json의 name-<id>가 있을 때만 (식별이 필요한 드래그 재료)
const itemName = (id: string): string | null => {
  const n = T(`name-${id}`)
  return n.startsWith('name-') ? null : n
}

// 성공 파티클 버스트 (판정 연출)
const BURST_COLORS = ['#8ae08f', '#f5b942', '#5a86e6', '#e88a9a']
function Burst({ gold = false }: { gold?: boolean }) {
  const n = gold ? 22 : 14
  return (
    <div className="burst">
      {Array.from({ length: n }, (_, i) => {
        const a = (i / n) * Math.PI * 2 + (i % 2) * 0.35
        const d = 150 + (i % 3) * 75
        const s = 13 + (i % 3) * 8
        return (
          <i
            key={i}
            style={
              {
                '--dx': `${Math.cos(a) * d}px`,
                '--dy': `${Math.sin(a) * d}px`,
                width: s,
                height: s,
                animationDelay: `${(i % 4) * 28}ms`,
                background: gold ? '#f5b942' : BURST_COLORS[i % 4],
              } as React.CSSProperties
            }
          />
        )
      })}
    </div>
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
  if (!sRef.current) {
    const s = createSession(Date.now() & 0xffffffff)
    // 캡처·QA 전용: ?round=N 으로 특정 라운드에서 시작 (심사 노출 없음 — 촬영·검수 도구)
    const round = Number(new URLSearchParams(window.location.search).get('round') || 0)
    if (round >= 2) {
      s.levelIndex = round - 1
      s.level = makeLevel(THEME_ORDER[(round - 1) % THEME_ORDER.length], difficultyOf(round - 1), s.rng)
    }
    sRef.current = s
  }
  const wrapRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(0.5)
  // 이펙트 엣지 감지·거품 팝 상태 (렌더 전용)
  const fxRef = useRef({ drop: 0, rep: 0, fly: 0, hit: 0, scrubKey: -1, dead: new Set<number>(), pops: [] as { x: number; y: number; t: number }[] })

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
    let prevPhase = ''
    let prevPenalty = 0
    startBgm('bgm-main')
    const loop = (now: number) => {
      acc += Math.min(now - last, 100)
      last = now
      const s = sRef.current!
      while (acc >= FIXED) {
        tickSession(s, FIXED)
        acc -= FIXED
      }
      // 사운드 트리거 (엣지 감지 — 승격된 오디오 없으면 전부 무음 no-op)
      if (s.phase !== prevPhase) {
        if (s.phase === 'instruct') playSfx('sfx-start')
        if (s.phase === 'result') playSfx(s.lastResult === 'clear' ? (s.lastPerfect ? 'sfx-perfect' : 'sfx-success') : 'sfx-fail')
        prevPhase = s.phase
      }
      const pen = s.level.penaltyT
      if (pen > 0 && prevPenalty <= 0) playSfx('sfx-penalty')
      prevPenalty = pen
      // 인터랙션 사운드 — 상황별 매핑 (디렉터 피드백: 행위에 맞는 소리)
      const f = fxRef.current
      const lv2 = s.level
      if (lv2.template === 'drag') {
        if (lv2.dropFxT > f.drop) playSfx(lv2.theme === 'cvs' ? 'sfx-scan' : 'sfx-place')
        f.drop = lv2.dropFxT
      } else f.drop = 0
      if (lv2.template === 'timing') {
        if (lv2.repFxT > f.rep) playSfx(lv2.theme === 'chicken' ? 'sfx-dip' : lv2.theme === 'fish' ? 'sfx-flip' : 'sfx-place')
        f.rep = lv2.repFxT
        // 물 따르기 루프 — 홀드 중에만
        if (lv2.pattern === 'hold' && s.phase === 'play' && lv2.holding) startLoopSfx('sfx-pour')
        else if (lv2.pattern === 'hold') stopLoopSfx()
      } else f.rep = 0
      if (lv2.template === 'mash' && lv2.kind === 'tap') { if (lv2.flyT > f.fly) playSfx('sfx-thud'); f.fly = lv2.flyT } else f.fly = 0
      if (lv2.template === 'mash' && lv2.kind === 'shake') { if (lv2.hitCount > f.hit) playSfx('sfx-tambourine'); f.hit = lv2.hitCount } else f.hit = 0
      if (lv2.template === 'mash' && lv2.kind === 'scrub') {
        if (f.scrubKey !== s.levelIndex) { f.scrubKey = s.levelIndex; f.dead = new Set(); f.pops = [] }
        // 문지르기 루프 — 터치 중에만
        if (s.phase === 'play' && lv2.lastP) startLoopSfx('sfx-scrub')
        else stopLoopSfx()
        lv2.blobs.forEach((b, i) => {
          if (b.hp <= 0 && !f.dead.has(i)) { f.dead.add(i); f.pops.push({ x: b.x, y: b.y, t: 400 }); playSfx('sfx-place') }
        })
      }
      if (lv2.template !== 'timing' && !(lv2.template === 'mash' && lv2.kind === 'scrub') && s.phase !== 'play') stopLoopSfx()
      if (s.phase === 'result') stopLoopSfx() // 판정 순간 루프 정지
      f.pops.forEach(p => (p.t -= 17))
      f.pops = f.pops.filter(p => p.t > 0)
      if (difficultyOf(s.levelIndex) >= 2) startBgm('bgm-fast')
      if (s.phase === 'gameover' || s.phase === 'complete') {
        stopBgm()
        onGameOver(s)
        return
      }
      force(n => n + 1)
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => {
      cancelAnimationFrame(raf)
      stopBgm()
      stopLoopSfx()
    }
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

  const failing = s.phase === 'result' && s.lastResult === 'fail'
  return (
    <div className={`game-wrap ${failing ? 'shake' : ''}`} ref={wrapRef}>
      <div
        className="game-canvas"
        style={{
          width: LW,
          height: LH,
          transform: `scale(${scale})`,
          background: spriteUrl(lv.bgSprite)
            ? `#1a1815 url(${spriteUrl(lv.bgSprite)}) center / cover no-repeat`
            : BG[lv.bgSprite] ?? '#222',
        }}
        onPointerDown={pointer('down')}
        onPointerMove={pointer('move')}
        onPointerUp={pointer('up')}
        onPointerCancel={pointer('up')}
      >
        <div className="hud">
          <div className="lives">
            {spriteUrl('ui-life')
              ? Array.from({ length: LIVES }, (_, i) => (
                  <img key={i} className={`lifeicon ${i < s.lives ? '' : 'lost'}`} src={spriteUrl('ui-life')!} alt="" draggable={false} />
                ))
              : `${'❤️'.repeat(s.lives)}${'🖤'.repeat(Math.max(0, LIVES - s.lives))}`}
          </div>
          <div className="round">
            {T('sys-round').replace('{n}', String(s.levelIndex + 1)).replace('{m}', String(ROUNDS_TOTAL))}
          </div>
          <div className="score">{s.score}</div>
        </div>
        {(() => {
          const pct = Math.max(0, lv.timeRemain / lv.timeLimit) * 100
          const low = s.phase === 'play' && lv.timeRemain < lv.timeLimit * 0.3
          return (
            <div className={`timerbar ${low ? 'low' : ''}`}>
              <i className={low ? 'danger' : ''} style={{ width: `${pct}%` }} />
            </div>
          )
        })()}
        {s.combo >= 2 && (
          <div className="combo" key={s.combo}>
            {T('sys-combo').replace('{n}', String(s.combo))}
          </div>
        )}

        {lv.template === 'drag' && (
          <>
            {lv.orderIds.length > 0 && (
              <div
                className={`order ${spriteUrl('ui-order-panel') ? 'framed' : ''}`}
                style={spriteUrl('ui-order-panel') ? { backgroundImage: `url(${spriteUrl('ui-order-panel')})` } : undefined}
              >
                <span>{T('order-label')}</span>
                {lv.sequence
                  ? lv.orderIds.map((id, i) => (
                      <div key={`${id}-${i}`} className={`chipwrap ${i < lv.seqIdx ? 'used' : ''}`}>
                        <Chip id={id} />
                        <b>{i + 1}</b>
                      </div>
                    ))
                  : [...new Set(lv.orderIds)].map(id => {
                      const n = lv.orderIds.filter(x => x === id).length
                      return (
                        <div key={id} className="chipwrap">
                          <Chip id={id} />
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
                  <div className="wantchip" style={{ left: t.rect.x + t.rect.w / 2 - 31, top: t.rect.y - 98 }}>
                    <Chip id={t.wants} />
                    {itemName(t.wants) && <div className="wantlabel">{itemName(t.wants)}</div>}
                  </div>
                )}
              </div>
            ))}
            {lv.items.map(it => (
              <div key={it.key}>
                <Ph
                  id={it.id}
                  x={it.pos.x - it.size.x / 2}
                  y={it.pos.y - it.size.y / 2}
                  w={it.size.x}
                  h={it.size.y}
                  cls={it.held ? 'held' : it.done ? 'done' : ''}
                />
                {!it.done && itemName(it.id) && (
                  <div className="itemlabel" style={{ left: it.pos.x, top: it.pos.y + it.size.y / 2 + 8 }}>
                    {itemName(it.id)}
                  </div>
                )}
              </div>
            ))}
            {lv.dropFxT > 0 && lv.dropFxSlot >= 0 && lv.targets[lv.dropFxSlot] && (() => {
              const t = lv.targets[lv.dropFxSlot].rect
              return lv.theme === 'cvs'
                ? <div className="scanflash" style={{ left: t.x - 8, top: t.y - 8, width: t.w + 16, height: t.h + 16 }} />
                : <div className="dropstar" style={{ left: t.x + t.w / 2 - 28, top: t.y - 30 }}>✨</div>
            })()}
          </>
        )}

        {lv.template === 'timing' && (
          <>
            {lv.pattern === 'hold' && (() => {
              // 액체는 컵(투명 유리) '뒤' 레이어 — 컵 아트에서 추출한 내부 마스크로 픽셀 정확 클리핑
              const cup = lv.deco.find(d => d.id === 'cafe-cup')
              if (!cup) return null
              const r = cup.rect
              const v = Math.min(1, lv.value)
              const maskUrl = spriteUrl('cafe-cup-mask')
              if (v <= 0.01) return null
              return maskUrl ? (
                <div
                  className="cupmask2"
                  style={{ left: r.x, top: r.y, width: r.w, height: r.h, WebkitMaskImage: `url(${maskUrl})`, maskImage: `url(${maskUrl})` }}
                >
                  <div className="cupliquid" style={{ height: `${v * 78}%` }} />
                </div>
              ) : (
                <div className="cupclip" style={{ left: r.x + r.w * 0.28, top: r.y + r.h * 0.2, width: r.w * 0.44, height: r.h * 0.66 }}>
                  <div className="cupliquid" style={{ height: `${v * 80}%` }} />
                </div>
              )
            })()}
            {lv.deco.map(d => {
              const cls =
                d.id === 'cafe-kettle' && lv.holding ? 'tilt'
                : d.id === 'chicken-net' && lv.repFxT > 0 ? 'dip'
                : d.id === 'fish-bread' && lv.repFxT > 0 ? 'flip'
                : ''
              return <Ph key={d.id} id={d.id} x={d.rect.x} y={d.rect.y} w={d.rect.w} h={d.rect.h} cls={cls} />
            })}
            {lv.pattern === 'hold' && lv.holding && (() => {
              const cup = lv.deco.find(d => d.id === 'cafe-cup')!.rect
              const kettle = lv.deco.find(d => d.id === 'cafe-kettle')!.rect
              const streamTop = kettle.y + kettle.h * 0.72
              return <div className="pour" style={{ left: cup.x + cup.w * 0.5 - 6, top: streamTop, height: cup.y + cup.h * 0.3 - streamTop }} />
            })()}
            {lv.repFxT > 0 && <div className="dropstar" style={{ left: 330, top: GAUGE.y - 90 }}>✨</div>}
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
            {lv.deco.map(d => {
              const cls = d.id === 'song-tambourine' && lv.kind === 'shake' && lv.hitT > 0 ? (lv.hitSide === 'L' ? 'wiggleL' : 'wiggleR') : ''
              return <Ph key={d.id} id={d.id} x={d.rect.x} y={d.rect.y} w={d.rect.w} h={d.rect.h} cls={cls} />
            })}
            {lv.kind === 'tap' && lv.flyT > 0 && lv.flyFrom && (() => {
              // 박스가 포물선으로 트럭 짐칸에 실리는 연출
              const truck = lv.deco[0].rect
              const p = 1 - lv.flyT / 380
              const tx = truck.x + truck.w / 2
              const ty = truck.y + truck.h * 0.55
              const x = lv.flyFrom.x + (tx - lv.flyFrom.x) * p
              const y = lv.flyFrom.y + (ty - lv.flyFrom.y) * p - Math.sin(p * Math.PI) * 130
              const sc = 1 - 0.55 * p
              return <Ph id={lv.sprite} x={x - 90 * sc} y={y - 75 * sc} w={180 * sc} h={150 * sc} cls="flyghost" />
            })()}
            {lv.kind === 'shake' && lv.hitT > 0 && (
              <div key={lv.hitCount} className="note" style={{ left: lv.hitSide === 'L' ? 200 : 480, top: 880 }}>
                🎵
              </div>
            )}
            {lv.kind === 'scrub' &&
              fxRef.current.pops.map((p, i) => (
                <div key={i} className="foampop" style={{ left: p.x - 50, top: p.y - 50, opacity: p.t / 400 }} />
              ))}
            {lv.kind === 'scrub' && lv.lastP && spriteUrl('wash-sponge') && (
              <Ph id="wash-sponge" x={lv.lastP.x - 70} y={lv.lastP.y - 78} w={140} h={140} cls="flyghost" />
            )}
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
          <>
            {s.lastResult === 'clear' && <Burst gold={s.lastPerfect} />}
            {s.lastResult === 'clear' && s.lastPerfect && <div className="goldflash" />}
            <div className={`result ${s.lastResult ?? ''}`}>
              {s.lastResult === 'clear' ? (s.lastPerfect ? T('sys-perfect') : 'OK!') : T('sys-fail')}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
