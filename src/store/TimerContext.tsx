/* oxlint-disable react/only-export-components -- provider, hook, and pure session helpers intentionally share this module */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { addLapAtomic, deleteSessionDb, loadAll, replaceAll, saveModes, saveSession, saveSettings, setActiveSession } from '../lib/db'
import { activeTime, canRecord } from '../lib/calculations'
import { defaultModes, defaultSettings } from '../lib/defaults'
import type { BackupPayload, QuestionLap, UserSettings, WorkMode, WorkSession } from '../types'

export function withoutLatestLap(session: WorkSession): WorkSession {
  const latest = [...session.laps].sort((a, b) => b.recordedAt - a.recordedAt)[0]
  return latest ? { ...session, laps: session.laps.filter((lap) => lap.id !== latest.id), updatedAt: Date.now() } : session
}

export function withoutLap(session: WorkSession, lapId: string): WorkSession {
  return { ...session, laps: session.laps.filter((lap) => lap.id !== lapId).map((lap, index) => ({ ...lap, number: index + 1 })), updatedAt: Date.now() }
}

type SessionDraft = Pick<WorkSession, 'title' | 'modeId' | 'project' | 'subject' | 'targetQuestions' | 'expectedDurationMinutes' | 'notes'>

interface TimerContextValue {
  loaded: boolean
  sessions: WorkSession[]
  modes: WorkMode[]
  settings: UserSettings
  activeSession: WorkSession | null
  needsRestoration: boolean
  recording: boolean
  message: string
  startSession: (draft: SessionDraft) => Promise<WorkSession>
  recordQuestion: () => Promise<boolean>
  pauseSession: (reason?: string) => Promise<void>
  resumeSession: () => Promise<void>
  undoLap: () => Promise<void>
  finishSession: (at?: number) => Promise<WorkSession | null>
  discardActive: () => Promise<void>
  dismissRestoration: () => void
  updateSession: (session: WorkSession) => Promise<void>
  deleteSession: (id: string) => Promise<void>
  duplicateSession: (session: WorkSession) => Promise<WorkSession>
  continueSession: (session: WorkSession) => Promise<void>
  updateLap: (lapId: string, changes: Partial<QuestionLap>) => Promise<void>
  deleteLap: (lapId: string) => Promise<void>
  setModes: (modes: WorkMode[]) => Promise<void>
  setSettings: (settings: UserSettings) => Promise<void>
  restoreBackup: (payload: BackupPayload, merge: boolean) => Promise<void>
}

const TimerContext = createContext<TimerContextValue | null>(null)

export function TimerProvider({ children }: { children: ReactNode }) {
  const [loaded, setLoaded] = useState(false)
  const [sessions, setSessionsState] = useState<WorkSession[]>([])
  const [modes, setModesState] = useState<WorkMode[]>(defaultModes)
  const [settings, setSettingsState] = useState<UserSettings>(defaultSettings)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [needsRestoration, setNeedsRestoration] = useState(false)
  const [recording, setRecording] = useState(false)
  const [message, setMessage] = useState('')
  const sessionsRef = useRef<WorkSession[]>([])
  const activeIdRef = useRef<string | null>(null)
  const lastRecordRef = useRef<number | null>(null)
  const messageTimer = useRef<number | undefined>(undefined)

  const applySessions = useCallback((next: WorkSession[]) => {
    sessionsRef.current = next
    setSessionsState(next)
  }, [])

  useEffect(() => { activeIdRef.current = activeId }, [activeId])

  useEffect(() => {
    loadAll().then((data) => {
      const order = new Map(defaultModes.map((mode, index) => [mode.id, index]))
      const allModes = data.modes.length ? [...data.modes].sort((a, b) => (order.get(a.id) ?? 100) - (order.get(b.id) ?? 100) || a.createdAt - b.createdAt) : defaultModes
      applySessions(data.sessions)
      setModesState(allModes)
      setSettingsState({ ...defaultSettings, ...data.settings })
      setActiveId(data.activeSessionId)
      activeIdRef.current = data.activeSessionId
      setNeedsRestoration(Boolean(data.activeSessionId && data.sessions.some((session) => session.id === data.activeSessionId)))
      setLoaded(true)
      if (!data.modes.length) saveModes(defaultModes)
      if (!data.settings) saveSettings(defaultSettings)
    }).catch(() => setLoaded(true))
  }, [applySessions])

  useEffect(() => {
    const root = document.documentElement
    root.dataset.theme = settings.theme
    if (settings.theme === 'system') root.removeAttribute('data-theme')
  }, [settings.theme])

  const activeSession = useMemo(() => sessions.find((session) => session.id === activeId) ?? null, [sessions, activeId])

  const replaceSession = useCallback((next: WorkSession) => {
    applySessions(sessionsRef.current.map((session) => session.id === next.id ? next : session))
  }, [applySessions])

  const flash = useCallback((text: string) => {
    setMessage(text)
    window.clearTimeout(messageTimer.current)
    messageTimer.current = window.setTimeout(() => setMessage(''), 2100)
  }, [])

  const startSession = useCallback(async (draft: SessionDraft) => {
    const now = Date.now()
    const session: WorkSession = { ...draft, id: crypto.randomUUID(), startedAt: now, status: 'active', laps: [], pauses: [], createdAt: now, updatedAt: now }
    await saveSession(session)
    await setActiveSession(session.id)
    applySessions([session, ...sessionsRef.current])
    setActiveId(session.id); activeIdRef.current = session.id
    setNeedsRestoration(false)
    return session
  }, [applySessions])

  const recordQuestion = useCallback(async () => {
    const now = Date.now()
    const session = sessionsRef.current.find((item) => item.id === activeIdRef.current)
    if (!session || session.status !== 'active' || recording || !canRecord(lastRecordRef.current, now)) return false
    setRecording(true); lastRecordRef.current = now
    try {
      const total = activeTime(session, now)
      const previous = [...session.laps].sort((a, b) => b.recordedAt - a.recordedAt)[0]
      const lap: QuestionLap = {
        id: crypto.randomUUID(), sessionId: session.id, number: session.laps.length + 1, recordedAt: now,
        durationMs: Math.max(0, total - (previous?.totalActiveMs ?? 0)), totalActiveMs: total, note: '', invalid: false,
      }
      const next = { ...session, laps: [...session.laps, lap], updatedAt: now }
      await addLapAtomic(next, lap)
      replaceSession(next)
      flash(`Question ${lap.number} recorded • ${Math.floor(lap.durationMs / 60_000).toString().padStart(2, '0')}:${Math.floor(lap.durationMs % 60_000 / 1000).toString().padStart(2, '0')}`)
      return true
    } finally { setRecording(false) }
  }, [flash, recording, replaceSession])

  const updateActive = useCallback(async (change: (session: WorkSession) => WorkSession) => {
    const session = sessionsRef.current.find((item) => item.id === activeIdRef.current)
    if (!session) return
    const next = change(session)
    await saveSession(next); replaceSession(next)
  }, [replaceSession])

  const pauseSession = useCallback(async (reason?: string) => updateActive((session) => {
    if (session.status !== 'active') return session
    const now = Date.now()
    return { ...session, status: 'paused', pauses: [...session.pauses, { id: crypto.randomUUID(), sessionId: session.id, startedAt: now, reason }], updatedAt: now }
  }), [updateActive])

  const resumeSession = useCallback(async () => updateActive((session) => {
    if (session.status !== 'paused') return session
    const now = Date.now()
    return { ...session, status: 'active', pauses: session.pauses.map((pause, index) => index === session.pauses.length - 1 && !pause.endedAt ? { ...pause, endedAt: now } : pause), updatedAt: now }
  }), [updateActive])

  const undoLap = useCallback(async () => updateActive((session) => withoutLatestLap(session)), [updateActive])

  const finishSession = useCallback(async (at = Date.now()) => {
    const session = sessionsRef.current.find((item) => item.id === activeIdRef.current)
    if (!session) return null
    const next: WorkSession = {
      ...session, status: 'completed', finishedAt: at, updatedAt: at,
      pauses: session.pauses.map((pause) => !pause.endedAt ? { ...pause, endedAt: at } : pause),
    }
    await saveSession(next); await setActiveSession(null)
    replaceSession(next); setActiveId(null); activeIdRef.current = null; setNeedsRestoration(false)
    return next
  }, [replaceSession])

  const deleteSession = useCallback(async (id: string) => {
    await deleteSessionDb(id)
    applySessions(sessionsRef.current.filter((session) => session.id !== id))
    if (activeIdRef.current === id) { await setActiveSession(null); setActiveId(null); activeIdRef.current = null }
  }, [applySessions])

  const discardActive = useCallback(async () => {
    if (activeIdRef.current) await deleteSession(activeIdRef.current)
    setNeedsRestoration(false)
  }, [deleteSession])

  const updateSession = useCallback(async (session: WorkSession) => { await saveSession(session); replaceSession(session) }, [replaceSession])

  const updateLap = useCallback(async (lapId: string, changes: Partial<QuestionLap>) => updateActive((session) => ({ ...session, laps: session.laps.map((lap) => lap.id === lapId ? { ...lap, ...changes } : lap), updatedAt: Date.now() })), [updateActive])
  const deleteLap = useCallback(async (lapId: string) => updateActive((session) => withoutLap(session, lapId)), [updateActive])

  const duplicateSession = useCallback(async (source: WorkSession) => {
    const now = Date.now()
    const copy: WorkSession = { ...source, id: crypto.randomUUID(), title: `${source.title} (copy)`, startedAt: now, finishedAt: undefined, status: 'unfinished', laps: [], pauses: [], createdAt: now, updatedAt: now }
    await saveSession(copy); applySessions([copy, ...sessionsRef.current]); return copy
  }, [applySessions])

  const continueSession = useCallback(async (source: WorkSession) => {
    if (activeIdRef.current && activeIdRef.current !== source.id) throw new Error('Finish the current session first.')
    const next = { ...source, status: 'active' as const, finishedAt: undefined, updatedAt: Date.now() }
    await saveSession(next); await setActiveSession(next.id)
    replaceSession(next); setActiveId(next.id); activeIdRef.current = next.id; setNeedsRestoration(false)
  }, [replaceSession])

  const updateModes = useCallback(async (next: WorkMode[]) => { await saveModes(next); setModesState(next) }, [])
  const updateSettings = useCallback(async (next: UserSettings) => { await saveSettings(next); setSettingsState(next) }, [])

  const restoreBackup = useCallback(async (payload: BackupPayload, merge: boolean) => {
    const nextSessions = merge ? [...sessionsRef.current, ...payload.sessions.filter((item) => !sessionsRef.current.some((current) => current.id === item.id))] : payload.sessions
    const nextModes = merge ? [...modes, ...payload.modes.filter((item) => !modes.some((current) => current.id === item.id))] : payload.modes
    const data = { sessions: nextSessions, modes: nextModes, settings: merge ? settings : payload.settings, targets: payload.targets, records: payload.records }
    await replaceAll(data)
    applySessions(nextSessions); setModesState(nextModes); if (!merge) setSettingsState(payload.settings)
  }, [applySessions, modes, settings])

  const value = useMemo<TimerContextValue>(() => ({
    loaded, sessions, modes, settings, activeSession, needsRestoration, recording, message,
    startSession, recordQuestion, pauseSession, resumeSession, undoLap, finishSession, discardActive,
    dismissRestoration: () => setNeedsRestoration(false), updateSession, deleteSession, duplicateSession, continueSession,
    updateLap, deleteLap, setModes: updateModes, setSettings: updateSettings, restoreBackup,
  }), [loaded, sessions, modes, settings, activeSession, needsRestoration, recording, message, startSession, recordQuestion, pauseSession, resumeSession, undoLap, finishSession, discardActive, updateSession, deleteSession, duplicateSession, continueSession, updateLap, deleteLap, updateModes, updateSettings, restoreBackup])

  return <TimerContext.Provider value={value}>{children}</TimerContext.Provider>
}

export function useTimer() {
  const context = useContext(TimerContext)
  if (!context) throw new Error('useTimer must be used inside TimerProvider')
  return context
}
