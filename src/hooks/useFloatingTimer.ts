import { useCallback, useEffect, useRef } from 'react'
import { formatDuration, formatLap } from '../lib/calculations'
import type { UserSettings, WorkSession } from '../types'

declare global {
  interface Window {
    documentPictureInPicture?: { requestWindow: (options: { width: number; height: number }) => Promise<Window> }
  }
}

let floatingWindow: Window | null = null

export function createFloatingViewModel(session: WorkSession, activeMs: number, averageMs: number | null, rate: number) {
  const valid = session.laps.filter((lap) => !lap.invalid)
  return { sessionId: session.id, status: session.status, count: valid.length, activeMs, averageMs, rate, lastMs: valid.at(-1)?.durationMs ?? null }
}

interface Actions { record: () => void; pause: () => void; undo: () => void; toggleMode: () => void }

export function useFloatingTimer(session: WorkSession | null, modeName: string, activeMs: number, averageMs: number | null, rate: number, settings: UserSettings, actions: Actions) {
  const actionRef = useRef(actions)
  actionRef.current = actions

  const render = useCallback(() => {
    if (!floatingWindow || floatingWindow.closed || !session) return
    const doc = floatingWindow.document
    const model = createFloatingViewModel(session, activeMs, averageMs, rate)
    const set = (id: string, value: string) => { const el = doc.getElementById(id); if (el) el.textContent = value }
    doc.body.dataset.mode = settings.floatingMode
    doc.body.dataset.stats = String(settings.floatingStats)
    set('mode', modeName)
    set('status', session.status === 'paused' ? '● Paused' : '● Running')
    set('time', formatDuration(model.activeMs, settings.showMilliseconds))
    set('count', `${model.count} QUESTION${model.count === 1 ? '' : 'S'}`)
    set('last', `Last ${formatLap(model.lastMs)}`)
    set('average', `Avg ${formatLap(model.averageMs)}`)
    set('rate', `${model.rate.toFixed(1)}/hr`)
    set('pause', session.status === 'paused' ? 'Resume' : 'Pause')
    set('mode-toggle', settings.floatingMode === 'micro' ? 'Expand' : 'Micro')
    const record = doc.getElementById('record') as HTMLButtonElement | null
    if (record) record.disabled = session.status === 'paused'
  }, [session, modeName, activeMs, averageMs, rate, settings.floatingMode, settings.floatingStats, settings.showMilliseconds])

  useEffect(render, [render])

  const open = useCallback(async () => {
    if (floatingWindow && !floatingWindow.closed) { floatingWindow.focus(); return true }
    if (!window.documentPictureInPicture) return false
    floatingWindow = await window.documentPictureInPicture.requestWindow({
      width: settings.floatingMode === 'micro' ? 300 : 360,
      height: settings.floatingMode === 'micro' ? 155 : 230,
    })
    const doc = floatingWindow.document
    doc.title = 'Smart Question Timer'
    doc.head.innerHTML = `<style>
      *{box-sizing:border-box}body{margin:0;padding:14px;background:#10211f;color:#f8fafc;font-family:Inter,system-ui,sans-serif;overflow:hidden}
      .top{display:flex;justify-content:space-between;align-items:center;text-transform:capitalize;font-size:13px;font-weight:700}.status{color:#5eead4}
      .timer{text-align:center;font:700 38px/1.1 ui-monospace,SFMono-Regular,Consolas,monospace;font-variant-numeric:tabular-nums;margin-top:8px;letter-spacing:-1px}
      .count{text-align:center;color:#ccfbf1;font-size:14px;font-weight:800;letter-spacing:.12em;margin:3px 0 10px}.stats{display:flex;justify-content:center;gap:15px;color:#cbd5e1;font-size:12px;margin-bottom:10px}
      button{min-height:44px;border:1px solid #3d5d58;border-radius:10px;background:#1f3834;color:white;font-weight:750;padding:0 12px;cursor:pointer}button:focus-visible{outline:3px solid #fbbf24;outline-offset:2px}
      #record{width:100%;min-height:48px;background:#14b8a6;color:#062a25;border:0;font-size:15px;margin-bottom:8px}.actions{display:grid;grid-template-columns:repeat(4,1fr);gap:7px}body[data-stats=false] .stats{visibility:hidden}
      body[data-mode=micro]{padding:8px 10px}.micro .top,.micro .stats{display:none}body[data-mode=micro] .timer{font-size:29px;margin:0}body[data-mode=micro] .count{margin:0 0 6px;font-size:12px}body[data-mode=micro] #record{width:auto;margin:0;min-height:44px}body[data-mode=micro] .actions{grid-template-columns:1fr 1fr}body[data-mode=micro] .full{display:none}body[data-mode=micro] .controls{display:grid;grid-template-columns:1.3fr 1fr;gap:6px}
      @media(prefers-reduced-motion:reduce){*{scroll-behavior:auto!important}}
    </style>`
    doc.body.innerHTML = `<main class="micro"><div class="top"><span id="mode"></span><span class="status" id="status"></span></div><div class="timer" id="time"></div><div class="count" id="count"></div><div class="stats"><span id="last"></span><span id="average"></span><span id="rate"></span></div><div class="controls"><button id="record" aria-label="Record question">+1 QUESTION</button><div class="actions"><button id="pause"></button><button id="undo" aria-label="Undo last question">Undo</button><button class="full" id="full">Full App</button><button id="mode-toggle"></button></div></div><div aria-live="polite" id="live" style="position:absolute;clip:rect(0 0 0 0)"></div></main>`
    doc.getElementById('record')?.addEventListener('click', () => actionRef.current.record())
    doc.getElementById('pause')?.addEventListener('click', () => actionRef.current.pause())
    doc.getElementById('undo')?.addEventListener('click', () => actionRef.current.undo())
    doc.getElementById('full')?.addEventListener('click', () => window.focus())
    doc.getElementById('mode-toggle')?.addEventListener('click', () => actionRef.current.toggleMode())
    doc.addEventListener('keydown', (event) => {
      const target = event.target as HTMLElement
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable) return
      if (event.code === 'Space') { event.preventDefault(); actionRef.current.record() }
      if (event.key.toLowerCase() === 'p') actionRef.current.pause()
      if (event.ctrlKey && event.key.toLowerCase() === 'z') { event.preventDefault(); actionRef.current.undo() }
      if (event.key.toLowerCase() === 'm') actionRef.current.toggleMode()
    })
    floatingWindow.addEventListener('pagehide', () => { floatingWindow = null })
    render()
    return true
  }, [render, settings.floatingMode])

  return { open, isSupported: 'documentPictureInPicture' in window }
}
