import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { HashRouter, NavLink, Navigate, Outlet, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom'
import {
  Activity, AlarmClock, Archive, BarChart3, CalendarDays, Check, ChevronRight, Clock3,
  CloudOff, Download, FileClock, Focus, Gauge, History, LayoutDashboard, Menu, MoreHorizontal,
  Pause, Pencil, Play, Plus, RotateCcw, Save, Search, Settings as SettingsIcon, Shapes, SlidersHorizontal,
  Sparkles, Square, Sun, Target, TimerReset, Trash2, Undo2, Upload, X, Zap,
} from 'lucide-react'
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { useTimer } from './store/TimerContext'
import { activeTime, averageTime, completionPercent, elapsedTime, estimatedRemainingTime, fastestLap, formatDuration, formatLap, isTypingTarget, longestPause, medianTime, pauseDuration, questionsPerHour, slowestLap, speedTrend, validLaps } from './lib/calculations'
import { downloadFile, toCsv, validateBackup } from './lib/backup'
import { useFloatingTimer } from './hooks/useFloatingTimer'
import type { BackupPayload, WorkMode, WorkSession } from './types'
import './index.css'

const palette = ['#0f766e', '#2563eb', '#7c3aed', '#d97706', '#db2777', '#0891b2', '#dc2626', '#64748b']

function useNow(fast = false) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), fast ? 50 : 1000); return () => window.clearInterval(timer) }, [fast])
  return now
}

function modeFor(session: WorkSession, modes: WorkMode[]) { return modes.find((mode) => mode.id === session.modeId) }
function sameDay(timestamp: number, date = new Date()) { const value = new Date(timestamp); return value.toDateString() === date.toDateString() }
function formatDate(timestamp: number) { return Number.isFinite(timestamp) ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(timestamp) : 'Unknown date' }
function formatTime(timestamp: number, hour12 = true) { return Number.isFinite(timestamp) ? new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit', hour12 }).format(timestamp) : '—' }
function isoDate(timestamp: number) { return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : '' }
function humanDuration(ms: number) { if (!Number.isFinite(ms)) return '—'; const hours = Math.floor(ms / 3_600_000); const minutes = Math.round(ms % 3_600_000 / 60_000); return `${hours ? `${hours}h ` : ''}${minutes}m` }

function PageHeader({ eyebrow, title, description, action }: { eyebrow?: string; title: string; description?: string; action?: ReactNode }) {
  return <header className="page-header"><div>{eyebrow && <p className="eyebrow">{eyebrow}</p>}<h1>{title}</h1>{description && <p className="page-description">{description}</p>}</div>{action}</header>
}

function Card({ children, className = '' }: { children: ReactNode; className?: string }) { return <section className={`card ${className}`}>{children}</section> }

function StatCard({ icon, label, value, detail, accent }: { icon: ReactNode; label: string; value: string; detail?: string; accent?: boolean }) {
  return <Card className={`stat-card ${accent ? 'accent-card' : ''}`}><div className="stat-icon">{icon}</div><div><p>{label}</p><strong>{value}</strong>{detail && <small>{detail}</small>}</div></Card>
}

function Empty({ icon, title, text, action }: { icon: ReactNode; title: string; text: string; action?: ReactNode }) {
  return <div className="empty-state"><span>{icon}</span><h3>{title}</h3><p>{text}</p>{action}</div>
}

function Modal({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  useEffect(() => { const close = (event: KeyboardEvent) => event.key === 'Escape' && onClose(); window.addEventListener('keydown', close); return () => window.removeEventListener('keydown', close) }, [onClose])
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><div className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><div className="modal-heading"><h2 id="modal-title">{title}</h2><button className="icon-button" onClick={onClose} aria-label="Close dialog"><X size={20} /></button></div>{children}</div></div>
}

const navigation = [
  ['/', 'Dashboard', LayoutDashboard], ['/new', 'New Session', Plus], ['/active', 'Active Session', Focus],
  ['/history', 'Session History', History], ['/analytics', 'Analytics', BarChart3], ['/modes', 'Work Modes', Shapes],
  ['/targets', 'Targets & Records', Target], ['/backup', 'Backup & Export', Archive], ['/settings', 'Settings', SettingsIcon],
] as const

function Layout() {
  const { activeSession } = useTimer()
  const [mobileNav, setMobileNav] = useState(false)
  const { needRefresh: [needRefresh, setNeedRefresh], updateServiceWorker } = useRegisterSW()
  return <div className="app-shell">
    <aside className={`sidebar ${mobileNav ? 'open' : ''}`}>
      <div className="brand"><div className="brand-mark"><TimerReset /></div><div><strong>SMART</strong><span>Question Timer</span></div><button className="icon-button mobile-close" aria-label="Close navigation" onClick={() => setMobileNav(false)}><X /></button></div>
      <nav aria-label="Primary navigation">{navigation.map(([to, label, Icon]) => <NavLink key={to} to={to} end={to === '/'} onClick={() => setMobileNav(false)} className={({ isActive }) => isActive ? 'active' : ''}><Icon size={19} /><span>{label}</span>{to === '/active' && activeSession && <i />}</NavLink>)}</nav>
      <div className="local-note"><CloudOff size={17} /><div><strong>Private by design</strong><span>Data stays on this device</span></div></div>
    </aside>
    <div className="main-column">
      <div className="mobile-bar"><button className="icon-button" aria-label="Open navigation" onClick={() => setMobileNav(true)}><Menu /></button><span>Smart Question Timer</span>{activeSession ? <span className="live-dot" /> : <span />}</div>
      {activeSession && <div className="active-strip"><span className="pulse-dot" /> <strong>{activeSession.title}</strong><span>{activeSession.status === 'paused' ? 'Paused' : 'Running'}</span><NavLink to="/active">Open timer <ChevronRight size={15} /></NavLink></div>}
      <main className="content"><Outlet /></main>
    </div>
    {needRefresh && <div className="update-toast"><div><strong>A new version is available.</strong><span>{activeSession ? 'Finish or pause safely before updating.' : 'Your local data is already saved.'}</span></div><button className="button secondary" onClick={() => setNeedRefresh(false)}>Later</button><button className="button primary" onClick={() => updateServiceWorker(true)} disabled={activeSession?.status === 'active'}>Update Now</button></div>}
  </div>
}

function Dashboard() {
  const { sessions, modes, settings } = useTimer()
  const now = useNow()
  const [range, setRange] = useState('7')
  const completed = sessions.filter((session) => session.status === 'completed')
  const todaySessions = sessions.filter((session) => sameDay(session.startedAt))
  const todayQuestions = todaySessions.reduce((sum, session) => sum + validLaps(session).length, 0)
  const todayActive = todaySessions.reduce((sum, session) => sum + activeTime(session, now), 0)
  const cutoff = range === 'all' ? 0 : Date.now() - Number(range) * 86_400_000
  const filtered = completed.filter((session) => session.startedAt >= cutoff)
  const days = useMemo(() => {
    const result: Array<{ date: string; questions: number; active: number; rate: number }> = []
    const count = range === '30' ? 30 : 7
    for (let index = count - 1; index >= 0; index--) {
      const date = new Date(); date.setDate(date.getDate() - index)
      const items = sessions.filter((session) => sameDay(session.startedAt, date))
      const questions = items.reduce((sum, session) => sum + validLaps(session).length, 0)
      const active = items.reduce((sum, session) => sum + activeTime(session, now), 0)
      result.push({ date: date.toLocaleDateString(undefined, { weekday: 'short' }), questions, active: Math.round(active / 60_000), rate: active ? questions / (active / 3_600_000) : 0 })
    }
    return result
  }, [sessions, now, range])
  const modeTotals = modes.map((mode) => ({ name: mode.name, value: filtered.filter((session) => session.modeId === mode.id).reduce((sum, session) => sum + validLaps(session).length, 0), color: mode.color })).filter((item) => item.value)
  const mostUsed = [...modeTotals].sort((a, b) => b.value - a.value)[0]?.name ?? 'No data yet'
  const avg = todayQuestions ? todayActive / todayQuestions : null
  const rate = todayActive ? todayQuestions / (todayActive / 3_600_000) : 0
  return <>
    <PageHeader eyebrow="Monday, focused" title="Your productivity, at a glance" description="A clear view of question work completed on this device." action={<NavLink to="/new" className="button primary"><Plus size={18} /> New Session</NavLink>} />
    <div className="filter-row" aria-label="Date range">{[['1', 'Today'], ['7', 'Last 7 days'], ['30', 'Last 30 days'], ['all', 'All time']].map(([value, label]) => <button key={value} className={range === value ? 'selected' : ''} onClick={() => setRange(value)}>{label}</button>)}</div>
    <div className="stats-grid">
      <StatCard icon={<Check />} label="Questions today" value={String(todayQuestions)} detail={`${Math.min(100, todayQuestions / settings.dailyTarget * 100).toFixed(0)}% of daily target`} accent />
      <StatCard icon={<Clock3 />} label="Active time today" value={humanDuration(todayActive)} detail="Paused time excluded" />
      <StatCard icon={<TimerReset />} label="Average per question" value={avg == null ? '—' : formatLap(avg)} detail={avg == null ? 'No questions recorded yet' : 'Based on active time'} />
      <StatCard icon={<Zap />} label="Questions per hour" value={rate.toFixed(1)} detail={`${todaySessions.filter((s) => s.status === 'completed').length} sessions completed`} />
    </div>
    <div className="dashboard-grid">
      <Card className="chart-card wide"><div className="card-heading"><div><p className="eyebrow">Output</p><h2>Questions completed</h2></div><span className="trend-pill"><Activity size={14} /> Daily view</span></div><div className="chart"><ResponsiveContainer width="100%" height="100%"><AreaChart data={days}><defs><linearGradient id="fillQ" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#0f766e" stopOpacity={0.32}/><stop offset="95%" stopColor="#0f766e" stopOpacity={0}/></linearGradient></defs><CartesianGrid vertical={false} stroke="#dfe4df" strokeDasharray="4 4"/><XAxis dataKey="date" tickLine={false} axisLine={false}/><YAxis tickLine={false} axisLine={false}/><Tooltip/><Area type="monotone" dataKey="questions" stroke="#0f766e" strokeWidth={3} fill="url(#fillQ)" /></AreaChart></ResponsiveContainer></div></Card>
      <Card className="focus-card"><p className="eyebrow">Today’s target</p><div className="target-ring" style={{ '--progress': `${Math.min(100, todayQuestions / settings.dailyTarget * 100)}%` } as React.CSSProperties}><div><strong>{todayQuestions}</strong><span>of {settings.dailyTarget}</span></div></div><p>{todayQuestions >= settings.dailyTarget ? 'Target complete — excellent consistency.' : `${Math.max(0, settings.dailyTarget - todayQuestions)} questions to reach today’s goal.`}</p><NavLink to="/targets" className="text-link">Adjust target <ChevronRight size={15} /></NavLink></Card>
      <Card className="chart-card"><div className="card-heading"><div><p className="eyebrow">Time</p><h2>Active minutes</h2></div></div><div className="chart small"><ResponsiveContainer width="100%" height="100%"><BarChart data={days}><XAxis dataKey="date" tickLine={false} axisLine={false}/><Tooltip/><Bar dataKey="active" fill="#2563eb" radius={[6,6,0,0]} /></BarChart></ResponsiveContainer></div></Card>
      <Card className="mode-card"><div className="card-heading"><div><p className="eyebrow">Work mix</p><h2>Productivity by mode</h2></div></div>{modeTotals.length ? <><div className="donut"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={modeTotals} dataKey="value" nameKey="name" innerRadius={45} outerRadius={68} paddingAngle={3}>{modeTotals.map((item) => <Cell key={item.name} fill={item.color}/>)}</Pie><Tooltip/></PieChart></ResponsiveContainer></div><p className="mode-summary"><strong>{mostUsed}</strong> is your most-used mode.</p></> : <Empty icon={<Shapes />} title="No mode data yet" text="Finish a session to see your work mix." />}</Card>
    </div>
  </>
}

function NewSession() {
  const { modes, settings, activeSession, startSession } = useTimer()
  const navigate = useNavigate(); const location = useLocation()
  const similar = (location.state as { draft?: WorkSession } | null)?.draft
  const [draft, setDraft] = useState<{ title: string; modeId: string; project: string; subject: string; targetQuestions?: number; expectedDurationMinutes?: number; notes: string }>({ title: similar?.title ?? '', modeId: similar?.modeId ?? settings.defaultModeId, project: similar?.project ?? '', subject: similar?.subject ?? '', targetQuestions: similar?.targetQuestions ?? settings.defaultTarget, expectedDurationMinutes: similar?.expectedDurationMinutes ?? 90, notes: similar?.notes ?? '' })
  const [error, setError] = useState('')
  const submit = async (event: FormEvent) => { event.preventDefault(); if (!draft.title.trim() || !draft.modeId) { setError('Session title and work mode are required.'); return } if (activeSession) { setError('Finish the active session before starting another.'); return } await startSession({ ...draft, title: draft.title.trim() }); navigate('/active') }
  return <><PageHeader eyebrow="Plan with intent" title="Start a focused session" description="Set the context once, then let the timer stay out of your way." />
    <form className="session-form" onSubmit={submit}><Card className="form-card"><div className="form-section-heading"><span>01</span><div><h2>Session essentials</h2><p>The only required details.</p></div></div><div className="field-grid"><label className="field span-2"><span>Session title <b>*</b></span><input autoFocus value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} placeholder="e.g. Grade 10 English Question Creation" /></label><label className="field span-2"><span>Work mode <b>*</b></span><div className="mode-picker">{modes.map((mode) => <button type="button" key={mode.id} className={draft.modeId === mode.id ? 'chosen' : ''} onClick={() => setDraft({ ...draft, modeId: mode.id })}><i style={{ background: mode.color }} />{mode.name}{draft.modeId === mode.id && <Check size={16}/>}</button>)}</div></label></div></Card>
      <Card className="form-card"><div className="form-section-heading"><span>02</span><div><h2>Work context</h2><p>Optional details that make reports useful.</p></div></div><div className="field-grid"><label className="field"><span>Project or batch</span><input value={draft.project} onChange={(e) => setDraft({ ...draft, project: e.target.value })} placeholder="English Batch 4" /></label><label className="field"><span>Subject or category</span><input value={draft.subject} onChange={(e) => setDraft({ ...draft, subject: e.target.value })} placeholder="English" /></label><label className="field"><span>Target questions</span><input type="number" min="1" value={draft.targetQuestions} onChange={(e) => setDraft({ ...draft, targetQuestions: Number(e.target.value) || undefined })} /></label><label className="field"><span>Expected duration (minutes)</span><input type="number" min="1" value={draft.expectedDurationMinutes} onChange={(e) => setDraft({ ...draft, expectedDurationMinutes: Number(e.target.value) || undefined })} /></label><label className="field span-2"><span>Notes</span><textarea value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} placeholder="Optional instructions or context…" rows={3} /></label></div></Card>
      {error && <div className="error-message" role="alert">{error}</div>}<div className="start-panel"><div><strong>Ready when you are</strong><span>The timer begins only after you press start.</span></div><button className="button start-button" type="submit"><Play fill="currentColor" size={20} /> Start Session</button></div>
    </form></>
}

function ActiveSession() {
  const timer = useTimer(); const navigate = useNavigate(); const now = useNow(timer.settings.showMilliseconds)
  const session = timer.activeSession
  const [finishOpen, setFinishOpen] = useState(false); const [deleteLapId, setDeleteLapId] = useState<string | null>(null); const [pauseReason, setPauseReason] = useState('')
  const [pipMessage, setPipMessage] = useState('')
  const activeMs = session ? activeTime(session, now) : 0
  const avg = session ? averageTime(session, now) : null
  const rate = session ? questionsPerHour(session, now) : 0
  const toggleFloatingMode = () => timer.setSettings({ ...timer.settings, floatingMode: timer.settings.floatingMode === 'micro' ? 'standard' : 'micro' })
  const floating = useFloatingTimer(session, session ? (modeFor(session, timer.modes)?.name ?? session.modeId) : '', activeMs, avg, rate, timer.settings, { record: () => timer.recordQuestion(), pause: () => session?.status === 'paused' ? timer.resumeSession() : timer.pauseSession(), undo: () => timer.undoLap(), toggleMode: toggleFloatingMode })
  const openFloating = async () => {
    try {
      if (!await floating.open()) throw new Error('unsupported')
    } catch {
      setPipMessage('Document Picture-in-Picture needs a direct click in a current desktop version of Chrome. The main timer is still running.')
      window.setTimeout(() => setPipMessage(''), 5000)
    }
  }
  useEffect(() => {
    const shortcuts = (event: KeyboardEvent) => {
      if (!timer.settings.keyboardShortcuts || isTypingTarget(event.target)) return
      if (event.code === 'Space') { event.preventDefault(); timer.recordQuestion() }
      else if (event.key.toLowerCase() === 'p') { if (session?.status === 'paused') timer.resumeSession(); else timer.pauseSession(pauseReason) }
      else if (event.ctrlKey && event.key.toLowerCase() === 'z') { event.preventDefault(); timer.undoLap() }
      else if (event.key.toLowerCase() === 'f') openFloating()
      else if (event.key.toLowerCase() === 'm') toggleFloatingMode()
    }
    window.addEventListener('keydown', shortcuts); return () => window.removeEventListener('keydown', shortcuts)
  })
  if (!session) return <Empty icon={<TimerReset />} title="No active session" text="Start a new session to begin tracking question work." action={<NavLink to="/new" className="button primary"><Plus size={18}/> New Session</NavLink>} />
  const valid = validLaps(session); const last = valid.at(-1); const percent = completionPercent(session); const remaining = estimatedRemainingTime(session, now)
  const estimate = remaining == null ? '—' : formatTime(now + remaining, timer.settings.clockFormat === '12')
  const finish = async () => { const done = await timer.finishSession(); setFinishOpen(false); if (done) navigate(`/summary/${done.id}`) }
  return <div className="active-page">
    <div className="active-heading"><div><span className={`status-badge ${session.status}`}>{session.status === 'paused' ? <Pause size={14}/> : <span className="pulse-dot"/>}{session.status === 'paused' ? 'Paused' : 'Running'}</span><h1>{session.title}</h1><p><span style={{ color: modeFor(session, timer.modes)?.color }}>●</span> {modeFor(session, timer.modes)?.name}{session.project && ` · ${session.project}`}</p></div><div className="active-actions"><button className="button secondary" onClick={openFloating}><Square size={17}/> Open Floating Timer</button><button className="button danger-ghost" onClick={() => setFinishOpen(true)}><Square size={16}/> Finish Session</button></div></div>
    {session.status === 'paused' && <div className="paused-banner"><Pause size={19}/><div><strong>Timer paused</strong><span>Overall time continues; active time is stopped.</span></div></div>}
    <div className="timer-panel"><div className="timer-label">Active working time</div><div className="main-timer">{formatDuration(activeMs, timer.settings.showMilliseconds)}</div><div className="question-total"><strong>{valid.length}</strong><span>questions completed</span></div><button data-testid="record-question" className="record-button" onClick={() => timer.recordQuestion()} disabled={session.status === 'paused' || timer.recording}><Plus size={27}/>{timer.recording ? 'Saving…' : 'Record Question'}<kbd>Space</kbd></button><div className="timer-controls"><div className="pause-combo"><button className="button secondary control" onClick={() => session.status === 'paused' ? timer.resumeSession() : timer.pauseSession(pauseReason)}>{session.status === 'paused' ? <Play size={19}/> : <Pause size={19}/>} {session.status === 'paused' ? 'Resume' : 'Pause'}</button>{session.status !== 'paused' && <select aria-label="Pause reason" value={pauseReason} onChange={(e) => setPauseReason(e.target.value)}><option value="">Reason (optional)</option><option>Short break</option><option>Lunch</option><option>Meeting</option><option>Technical issue</option><option>Personal interruption</option><option>Other</option></select>}</div><button className="button secondary control" onClick={() => timer.undoLap()} disabled={!session.laps.length}><Undo2 size={19}/> Undo Last</button></div><div className="shortcut-hint">P pause / resume · Ctrl+Z undo · F floating timer · M micro mode</div></div>
    <div className="live-feedback" aria-live="polite">{timer.message || pipMessage}</div>
    <div className="metrics-row"><div><span>Last question</span><strong>{last ? formatLap(last.durationMs) : '—'}</strong></div><div><span>Average</span><strong>{avg == null ? '—' : formatLap(avg)}</strong></div><div><span>Questions / hour</span><strong>{rate.toFixed(1)}</strong></div><div><span>Target progress</span><strong>{percent == null ? 'No target' : `${percent.toFixed(0)}%`}</strong></div><div><span>Estimated finish</span><strong>{estimate}</strong></div></div>
    {session.targetQuestions && <Card className="progress-card"><div><span>Target progress</span><strong>{valid.length} of {session.targetQuestions} questions</strong></div><div className="progress-track"><span style={{ width: `${percent ?? 0}%` }}/></div><span>{remaining == null ? 'Record a question to calculate an estimate' : `${formatDuration(remaining)} remaining at your current average`}</span></Card>}
    <Card className="lap-card"><div className="card-heading"><div><p className="eyebrow">Newest first</p><h2>Question laps</h2></div><span>{session.laps.length} recorded</span></div>{session.laps.length ? <div className="table-wrap"><table><thead><tr><th>Question</th><th>Lap time</th><th>Total active</th><th>Recorded at</th><th>Note</th><th><span className="sr-only">Actions</span></th></tr></thead><tbody>{[...session.laps].reverse().map((lap) => <tr key={lap.id} className={lap.invalid ? 'invalid-row' : ''}><td><strong>Q{lap.number}</strong>{lap.invalid && <small>Invalid</small>}</td><td>{formatLap(lap.durationMs)}</td><td>{formatDuration(lap.totalActiveMs)}</td><td>{formatTime(lap.recordedAt, timer.settings.clockFormat === '12')}</td><td><input aria-label={`Note for question ${lap.number}`} defaultValue={lap.note} placeholder="Add note" onBlur={(e) => timer.updateLap(lap.id, { note: e.target.value })}/></td><td><div className="row-actions"><button className="icon-button" title={lap.invalid ? 'Restore lap' : 'Mark invalid'} aria-label={lap.invalid ? `Restore question ${lap.number}` : `Mark question ${lap.number} invalid`} onClick={() => timer.updateLap(lap.id, { invalid: !lap.invalid })}>{lap.invalid ? <RotateCcw size={17}/> : <X size={17}/>}</button><button className="icon-button danger" title="Delete lap" aria-label={`Delete question ${lap.number}`} onClick={() => setDeleteLapId(lap.id)}><Trash2 size={17}/></button></div></td></tr>)}</tbody></table></div> : <Empty icon={<FileClock/>} title="No questions recorded yet" text="Press the large Record Question button whenever a question is complete." />}</Card>
    {finishOpen && <Modal title="Finish this session?" onClose={() => setFinishOpen(false)}><p>The timer will stop and a final summary will be saved. You can still edit session details afterward.</p><div className="modal-actions"><button className="button secondary" onClick={() => setFinishOpen(false)}>Keep working</button><button className="button primary" onClick={finish}><Check size={18}/> Finish Session</button></div></Modal>}
    {deleteLapId && <Modal title="Delete this lap permanently?" onClose={() => setDeleteLapId(null)}><p>This cannot be undone. Statistics will be recalculated automatically.</p><div className="modal-actions"><button className="button secondary" onClick={() => setDeleteLapId(null)}>Cancel</button><button className="button danger-button" onClick={async () => { await timer.deleteLap(deleteLapId); setDeleteLapId(null) }}><Trash2 size={18}/> Delete lap</button></div></Modal>}
  </div>
}

function SessionSummary() {
  const { id } = useParams(); const timer = useTimer(); const navigate = useNavigate()
  const session = timer.sessions.find((item) => item.id === id); const [saved, setSaved] = useState(false)
  const [edit, setEdit] = useState({ title: session?.title ?? '', project: session?.project ?? '', notes: session?.notes ?? '' })
  if (!session) return <Navigate to="/history" replace />
  const valid = validLaps(session); const active = activeTime(session); const elapsed = elapsedTime(session); const paused = pauseDuration(session); const avg = averageTime(session)
  const save = async () => { await timer.updateSession({ ...session, ...edit, updatedAt: Date.now() }); setSaved(true); window.setTimeout(() => setSaved(false), 2000) }
  const exportOne = () => downloadFile(`${session.title.replace(/[^a-z0-9]+/gi, '-')}.json`, JSON.stringify(session, null, 2), 'application/json')
  return <><PageHeader eyebrow="Session complete" title="A clear finish, with useful context" description="Your local record is ready to review, edit, or export." action={<span className="success-pill"><Check size={16}/> Saved on this device</span>} />
    <Card className="summary-hero"><div><span className="mode-chip" style={{ '--mode': modeFor(session, timer.modes)?.color } as React.CSSProperties}>{modeFor(session, timer.modes)?.name}</span><input className="summary-title-input" value={edit.title} onChange={(e) => setEdit({ ...edit, title: e.target.value })}/><p>{edit.project || 'No project'} · {formatDate(session.startedAt)}</p></div><div className="summary-count"><strong>{valid.length}</strong><span>questions</span></div></Card>
    <div className="stats-grid summary-stats"><StatCard icon={<Clock3/>} label="Active work" value={humanDuration(active)} detail={`${humanDuration(elapsed)} total elapsed`} /><StatCard icon={<Pause/>} label="Paused time" value={humanDuration(paused)} detail={`${session.pauses.length} pause${session.pauses.length === 1 ? '' : 's'}`} /><StatCard icon={<TimerReset/>} label="Average" value={formatLap(avg)} detail={`Median ${formatLap(medianTime(session))}`} /><StatCard icon={<Zap/>} label="Questions / hour" value={questionsPerHour(session).toFixed(1)} detail={`Trend: ${speedTrend(session)}`} accent /></div>
    <div className="summary-grid"><Card><div className="card-heading"><div><p className="eyebrow">Performance</p><h2>Session details</h2></div></div><dl className="detail-list"><div><dt>Started</dt><dd>{formatTime(session.startedAt)} · {formatDate(session.startedAt)}</dd></div><div><dt>Finished</dt><dd>{formatTime(session.finishedAt ?? session.updatedAt)}</dd></div><div><dt>Target</dt><dd>{session.targetQuestions ?? 'Not set'} {session.targetQuestions && `· ${(completionPercent(session) ?? 0).toFixed(0)}% complete`}</dd></div><div><dt>Fastest question</dt><dd>{formatLap(fastestLap(session)?.durationMs ?? null)}</dd></div><div><dt>Slowest question</dt><dd>{formatLap(slowestLap(session)?.durationMs ?? null)}</dd></div><div><dt>Longest pause</dt><dd>{formatDuration(longestPause(session))}</dd></div></dl></Card><Card><div className="card-heading"><div><p className="eyebrow">Reflection</p><h2>Notes</h2></div></div><label className="field"><span>Project or batch</span><input value={edit.project} onChange={(e) => setEdit({ ...edit, project: e.target.value })}/></label><label className="field"><span>Session notes</span><textarea rows={6} value={edit.notes} onChange={(e) => setEdit({ ...edit, notes: e.target.value })} placeholder="Add observations or follow-up notes…"/></label></Card></div>
    <Card className="conclusion"><Sparkles/><p>You completed <strong>{valid.length} questions</strong> in <strong>{humanDuration(active)}</strong> of active work. Your average time was <strong>{formatLap(avg)}</strong> per question, with a speed of <strong>{questionsPerHour(session).toFixed(1)} questions per hour</strong>.</p></Card>
    <div className="summary-actions"><button className="button primary" onClick={save}><Save size={18}/>{saved ? 'Saved' : 'Save Session'}</button><button className="button secondary" onClick={exportOne}><Download size={18}/> Export Session</button><button className="button secondary" onClick={() => navigate('/new', { state: { draft: session } })}><RotateCcw size={18}/> Start Similar</button><button className="button danger-ghost" onClick={async () => { if (window.confirm('Delete this session permanently?')) { await timer.deleteSession(session.id); navigate('/history') } }}><Trash2 size={18}/> Delete Session</button></div>
  </>
}

function SessionHistory() {
  const timer = useTimer(); const navigate = useNavigate(); const [query, setQuery] = useState(''); const [mode, setMode] = useState('all'); const [status, setStatus] = useState('all')
  const filtered = timer.sessions.filter((session) => `${session.title} ${session.project} ${session.subject}`.toLowerCase().includes(query.toLowerCase()) && (mode === 'all' || session.modeId === mode) && (status === 'all' || (status === 'completed' ? session.status === 'completed' : session.status !== 'completed'))).sort((a,b) => b.startedAt-a.startedAt)
  const exportSession = (session: WorkSession) => downloadFile('session.json', JSON.stringify(session, null, 2), 'application/json')
  return <><PageHeader eyebrow="Your archive" title="Session history" description="Search, filter, continue, duplicate, and export every locally saved session." action={<NavLink to="/new" className="button primary"><Plus size={18}/> New Session</NavLink>} />
    <Card className="history-card"><div className="history-filters"><label className="search-field"><Search size={18}/><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search title, project, or subject" aria-label="Search sessions"/></label><label><span className="sr-only">Filter by mode</span><select value={mode} onChange={(e) => setMode(e.target.value)}><option value="all">All work modes</option>{timer.modes.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label><label><span className="sr-only">Filter by status</span><select value={status} onChange={(e) => setStatus(e.target.value)}><option value="all">All statuses</option><option value="completed">Completed</option><option value="unfinished">Unfinished</option></select></label></div>
      {filtered.length ? <div className="table-wrap"><table><thead><tr><th>Date</th><th>Session</th><th>Mode</th><th>Questions</th><th>Active</th><th>Paused</th><th>Average</th><th>Rate</th><th>Status</th><th></th></tr></thead><tbody>{filtered.map((session) => <tr key={session.id}><td>{formatDate(session.startedAt)}</td><td><button className="session-link" onClick={() => navigate(`/summary/${session.id}`)}><strong>{session.title}</strong><span>{session.project || session.subject || 'No project'}</span></button></td><td><span className="mode-dot" style={{ background: modeFor(session, timer.modes)?.color }}/>{modeFor(session, timer.modes)?.name}</td><td>{validLaps(session).length}</td><td>{humanDuration(activeTime(session))}</td><td>{humanDuration(pauseDuration(session))}</td><td>{formatLap(averageTime(session))}</td><td>{questionsPerHour(session).toFixed(1)}</td><td><span className={`table-status ${session.status}`}>{session.status}</span></td><td><details className="more-menu"><summary aria-label={`Actions for ${session.title}`}><MoreHorizontal/></summary><div><button onClick={() => navigate(`/summary/${session.id}`)}>Open / edit</button>{session.status !== 'completed' && <button onClick={async () => { try { await timer.continueSession(session); navigate('/active') } catch (error) { alert((error as Error).message) } }}>Continue</button>}<button onClick={() => timer.duplicateSession(session)}>Duplicate</button><button onClick={() => exportSession(session)}>Export</button><button className="danger" onClick={() => window.confirm('Delete this session permanently?') && timer.deleteSession(session.id)}>Delete</button></div></details></td></tr>)}</tbody></table></div> : <Empty icon={<History/>} title="No matching sessions" text="Try a different filter or start your first focused session." action={<NavLink to="/new" className="button primary">Start a session</NavLink>} />}</Card>
  </>
}

function Analytics() {
  const { sessions, modes } = useTimer(); const [mode, setMode] = useState('all')
  const completed = sessions.filter((s) => s.status === 'completed' && (mode === 'all' || s.modeId === mode)).sort((a,b) => a.startedAt-b.startedAt)
  const series = completed.map((s) => ({ date: new Date(s.startedAt).toLocaleDateString(undefined,{month:'short',day:'numeric'}), average: Math.round((averageTime(s) ?? 0)/1000), rate: Number(questionsPerHour(s).toFixed(1)), questions: validLaps(s).length }))
  const projects = Object.values(completed.reduce<Record<string,{name:string;questions:number;active:number}>>((acc,s) => { const name=s.project||'No project'; acc[name] ??= {name,questions:0,active:0}; acc[name].questions += validLaps(s).length; acc[name].active += activeTime(s)/60000; return acc }, {})).sort((a,b)=>b.questions-a.questions).slice(0,8)
  const hours = Array.from({length:24},(_,hour)=>{ const laps=completed.flatMap(s=>s.laps).filter(l=>new Date(l.recordedAt).getHours()===hour&&!l.invalid); return {hour:`${String(hour).padStart(2,'0')}:00`,questions:laps.length} }).filter(x=>x.questions)
  return <><PageHeader eyebrow="Evidence, not guesswork" title="Analytics" description="Active time only. Invalid laps and unfinished sessions are excluded from performance reporting." action={<label className="inline-select"><SlidersHorizontal size={17}/><select value={mode} onChange={(e)=>setMode(e.target.value)}><option value="all">All work modes</option>{modes.map(m=><option key={m.id} value={m.id}>{m.name}</option>)}</select></label>} />
    {completed.length ? <div className="analytics-grid"><Card className="chart-card wide"><div className="card-heading"><div><p className="eyebrow">Speed over time</p><h2>Questions per hour</h2></div></div><div className="chart"><ResponsiveContainer width="100%" height="100%"><LineChart data={series}><CartesianGrid vertical={false} strokeDasharray="4 4"/><XAxis dataKey="date"/><YAxis/><Tooltip/><Line type="monotone" dataKey="rate" stroke="#0f766e" strokeWidth={3} dot={{r:4}}/></LineChart></ResponsiveContainer></div></Card><Card className="chart-card"><div className="card-heading"><div><p className="eyebrow">Pace</p><h2>Average seconds / question</h2></div></div><div className="chart small"><ResponsiveContainer width="100%" height="100%"><AreaChart data={series}><XAxis dataKey="date"/><Tooltip/><Area dataKey="average" fill="#c4b5fd" stroke="#7c3aed"/></AreaChart></ResponsiveContainer></div></Card><Card className="chart-card"><div className="card-heading"><div><p className="eyebrow">Projects</p><h2>Productivity by project</h2></div></div><div className="chart small"><ResponsiveContainer width="100%" height="100%"><BarChart data={projects} layout="vertical"><XAxis type="number"/><YAxis dataKey="name" type="category" width={90}/><Tooltip/><Bar dataKey="questions" fill="#2563eb" radius={[0,6,6,0]}/></BarChart></ResponsiveContainer></div></Card><Card className="chart-card wide"><div className="card-heading"><div><p className="eyebrow">Rhythm</p><h2>Productivity by hour of day</h2></div></div>{hours.length ? <div className="chart small"><ResponsiveContainer width="100%" height="100%"><BarChart data={hours}><XAxis dataKey="hour"/><Tooltip/><Bar dataKey="questions" fill="#d97706" radius={[5,5,0,0]}/></BarChart></ResponsiveContainer></div> : <Empty icon={<Clock3/>} title="Not enough hourly data" text="Recorded laps will reveal your most productive hours."/>}</Card></div> : <Empty icon={<BarChart3/>} title="Analytics will appear here" text="Complete a session with question laps to unlock reliable performance trends." action={<NavLink to="/new" className="button primary">Start a session</NavLink>}/>}</>
}

function WorkModes() {
  const timer = useTimer(); const [editing, setEditing] = useState<WorkMode | null>(null)
  const save = async (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); if (!editing?.name.trim()) return; const exists=timer.modes.some(m=>m.id===editing.id); await timer.setModes(exists?timer.modes.map(m=>m.id===editing.id?editing:m):[...timer.modes,editing]); setEditing(null) }
  return <><PageHeader eyebrow="Shape your workflow" title="Work modes" description="Use modes to compare creation, review, correction, and every custom workflow." action={<button className="button primary" onClick={()=>setEditing({id:crypto.randomUUID(),name:'',icon:'Shapes',color:palette[0],builtIn:false,createdAt:Date.now()})}><Plus size={18}/> Add Custom Mode</button>}/>
    <div className="mode-grid">{timer.modes.map(mode=><Card key={mode.id} className="mode-tile"><div className="mode-icon" style={{background:`${mode.color}18`,color:mode.color}}><Shapes/></div><div><h3>{mode.name}</h3><span>{mode.builtIn?'Default mode':'Custom mode'}</span></div>{!mode.builtIn&&<div className="tile-actions"><button className="icon-button" aria-label={`Edit ${mode.name}`} onClick={()=>setEditing(mode)}><Pencil size={17}/></button><button className="icon-button danger" aria-label={`Delete ${mode.name}`} onClick={()=>window.confirm(`Delete ${mode.name}? Existing sessions keep their saved mode ID.`)&&timer.setModes(timer.modes.filter(m=>m.id!==mode.id))}><Trash2 size={17}/></button></div>}<i className="mode-color" style={{background:mode.color}}/></Card>)}</div>
    {editing&&<Modal title={timer.modes.some(m=>m.id===editing.id)?'Edit custom mode':'Add custom mode'} onClose={()=>setEditing(null)}><form onSubmit={save}><label className="field"><span>Mode name</span><input autoFocus value={editing.name} onChange={e=>setEditing({...editing,name:e.target.value})} placeholder="e.g. Quality Check"/></label><label className="field"><span>Icon</span><select value={editing.icon} onChange={e=>setEditing({...editing,icon:e.target.value})}><option>Shapes</option><option>Brain</option><option>Sparkles</option><option>Upload</option><option>SearchCheck</option><option>PencilLine</option></select></label><fieldset className="color-field"><legend>Colour</legend><div>{palette.map(color=><button type="button" key={color} aria-label={`Choose ${color}`} className={editing.color===color?'chosen':''} style={{background:color}} onClick={()=>setEditing({...editing,color})}>{editing.color===color&&<Check/>}</button>)}</div></fieldset><div className="modal-actions"><button type="button" className="button secondary" onClick={()=>setEditing(null)}>Cancel</button><button className="button primary" type="submit"><Save size={18}/> Save Mode</button></div></form></Modal>}
  </>
}

function TargetsRecords() {
  const timer=useTimer(); const qualified=timer.sessions.filter(s=>s.status==='completed'&&validLaps(s).length>=timer.settings.minimumLapCount)
  const fastest=[...qualified].sort((a,b)=>(averageTime(a)??Infinity)-(averageTime(b)??Infinity))[0]; const highest=[...qualified].sort((a,b)=>questionsPerHour(b)-questionsPerHour(a))[0]
  return <><PageHeader eyebrow="Goals with guardrails" title="Targets & personal records" description={`Records require at least ${timer.settings.minimumLapCount} valid laps, so one-off results do not mislead.`}/><div className="target-layout"><Card className="daily-target-card"><Target/><div><p className="eyebrow">Daily question target</p><div className="target-editor"><input type="number" min="1" value={timer.settings.dailyTarget} onChange={e=>timer.setSettings({...timer.settings,dailyTarget:Number(e.target.value)||1})}/><span>questions per day</span></div><p>Used for your dashboard progress ring and optional target notifications.</p></div></Card><div className="records-grid"><StatCard icon={<Zap/>} label="Best questions / hour" value={highest?questionsPerHour(highest).toFixed(1):'—'} detail={highest?.title??'No qualifying session'} accent/><StatCard icon={<TimerReset/>} label="Fastest average" value={fastest?formatLap(averageTime(fastest)):'—'} detail={fastest?.title??'No qualifying session'}/><StatCard icon={<Check/>} label="Most questions" value={qualified.length?String(Math.max(...qualified.map(s=>validLaps(s).length))):'—'} detail="In one qualifying session"/><StatCard icon={<CalendarDays/>} label="Current streak" value={sessionsStreak(timer.sessions).toString()} detail="Consecutive active days"/></div></div></>
}

function sessionsStreak(sessions: WorkSession[]) { const dates=new Set(sessions.filter(s=>s.status==='completed').map(s=>new Date(s.startedAt).toDateString())); let streak=0; const date=new Date(); while(dates.has(date.toDateString())){streak++;date.setDate(date.getDate()-1)} return streak }

interface BeforeInstallPromptEvent extends Event { prompt: () => Promise<void>; userChoice: Promise<{outcome:'accepted'|'dismissed'}> }
function SettingsPage() {
  const timer=useTimer(); const [installPrompt,setInstallPrompt]=useState<BeforeInstallPromptEvent|null>(null); const [notice,setNotice]=useState('')
  useEffect(()=>{const listener=(event:Event)=>{event.preventDefault();setInstallPrompt(event as BeforeInstallPromptEvent)};window.addEventListener('beforeinstallprompt',listener);return()=>window.removeEventListener('beforeinstallprompt',listener)},[])
  const change=<K extends keyof typeof timer.settings>(key:K,value:(typeof timer.settings)[K])=>timer.setSettings({...timer.settings,[key]:value})
  const notifications=async(enabled:boolean)=>{ if(enabled&&'Notification'in window){const permission=await Notification.requestPermission();change('desktopNotifications',permission==='granted');setNotice(permission==='granted'?'Notifications enabled.':'Notification permission was not granted.')} else change('desktopNotifications',false) }
  return <><PageHeader eyebrow="Make it yours" title="Settings" description="Preferences are stored locally with your timer data."/>
    <div className="settings-layout"><Card><div className="settings-heading"><Sun/><div><h2>Appearance & time</h2><p>Choose how the app looks and formats time.</p></div></div><div className="settings-list"><label><span>Theme<small>Light, dark, or follow your system</small></span><select value={timer.settings.theme} onChange={e=>change('theme',e.target.value as 'light'|'dark'|'system')}><option value="system">System</option><option value="light">Light</option><option value="dark">Dark</option></select></label><label><span>Clock format<small>Used for recorded timestamps</small></span><select value={timer.settings.clockFormat} onChange={e=>change('clockFormat',e.target.value as '12'|'24')}><option value="12">12-hour</option><option value="24">24-hour</option></select></label><Toggle label="Show milliseconds" detail="Adds hundredths to running timers" checked={timer.settings.showMilliseconds} onChange={v=>change('showMilliseconds',v)}/><label><span>Start of week<small>Used for weekly reports</small></span><select value={timer.settings.startOfWeek} onChange={e=>change('startOfWeek',e.target.value as 'monday'|'sunday')}><option value="monday">Monday</option><option value="sunday">Sunday</option></select></label></div></Card>
      <Card><div className="settings-heading"><Gauge/><div><h2>Timer behaviour</h2><p>Control feedback, shortcuts, and records.</p></div></div><div className="settings-list"><Toggle label="Keyboard shortcuts" detail="Space, P, Ctrl+Z, F, and M" checked={timer.settings.keyboardShortcuts} onChange={v=>change('keyboardShortcuts',v)}/><Toggle label="Visual feedback" detail="Show brief confirmation after recording" checked={timer.settings.visualFeedback} onChange={v=>change('visualFeedback',v)}/><Toggle label="Sound feedback" detail="Optional recording sound" checked={timer.settings.soundFeedback} onChange={v=>change('soundFeedback',v)}/><label><span>Minimum laps for records<small>Protects against misleading personal bests</small></span><input className="small-input" type="number" min="1" value={timer.settings.minimumLapCount} onChange={e=>change('minimumLapCount',Number(e.target.value)||1)}/></label><label><span>Idle warning<small>0 disables the warning</small></span><div className="suffix-input"><input type="number" min="0" value={timer.settings.idleWarningMinutes} onChange={e=>change('idleWarningMinutes',Number(e.target.value)||0)}/><span>min</span></div></label></div></Card>
      <Card><div className="settings-heading"><Square/><div><h2>Floating timer</h2><p>Configure Chrome’s always-on-top timer.</p></div></div><div className="settings-list"><label><span>Default layout<small>Switch anytime with M</small></span><select value={timer.settings.floatingMode} onChange={e=>change('floatingMode',e.target.value as 'standard'|'micro')}><option value="standard">Standard (360 × 230)</option><option value="micro">Micro (300 × 155)</option></select></label><Toggle label="Show floating statistics" detail="Last, average, and questions/hour" checked={timer.settings.floatingStats} onChange={v=>change('floatingStats',v)}/></div></Card>
      <Card><div className="settings-heading"><AlarmClock/><div><h2>Notifications & backups</h2><p>Permission is requested only when enabled.</p></div></div><div className="settings-list"><Toggle label="Desktop notifications" detail="Targets, long sessions, and long pauses" checked={timer.settings.desktopNotifications} onChange={notifications}/><Toggle label="Backup reminders" detail="A gentle reminder to export local data" checked={timer.settings.backupReminders} onChange={v=>change('backupReminders',v)}/></div></Card>
      <Card className="install-card"><div className="settings-heading"><Download/><div><h2>Install the app</h2><p>Chrome can install this PWA in a standalone window with offline access.</p></div></div><button className="button primary" onClick={async()=>{if(installPrompt){await installPrompt.prompt();setInstallPrompt(null)}else setNotice('Use Chrome’s Install app option in the address bar or browser menu.')}}><Download size={18}/> Install PWA</button><small>This remains a Chrome web app, not a native Windows executable.</small></Card></div>{notice&&<div className="live-feedback visible" aria-live="polite">{notice}</div>}</>
}

function Toggle({label,detail,checked,onChange}:{label:string;detail:string;checked:boolean;onChange:(value:boolean)=>void}){return <label><span>{label}<small>{detail}</small></span><button type="button" role="switch" aria-checked={checked} className={`switch ${checked?'on':''}`} onClick={()=>onChange(!checked)}><span/></button></label>}

function BackupExport() {
  const timer=useTimer(); const input=useRef<HTMLInputElement>(null); const [message,setMessage]=useState(''); const [pending,setPending]=useState<BackupPayload|null>(null)
  const payload=():BackupPayload=>({version:1,exportedAt:Date.now(),app:'smart-question-timer',sessions:timer.sessions,modes:timer.modes,settings:timer.settings,targets:[],records:[]})
  const backup=()=>downloadFile(`smart-question-timer-backup-${new Date().toISOString().slice(0,10)}.json`,JSON.stringify(payload(),null,2),'application/json')
  const summaryCsv=()=>downloadFile('session-summary.csv',toCsv(timer.sessions.map(s=>({date:isoDate(s.startedAt),title:s.title,mode:modeFor(s,timer.modes)?.name??s.modeId,project:s.project,questions:validLaps(s).length,active_minutes:(activeTime(s)/60000).toFixed(2),paused_minutes:(pauseDuration(s)/60000).toFixed(2),average_seconds:((averageTime(s)??0)/1000).toFixed(2),questions_per_hour:questionsPerHour(s).toFixed(2),status:s.status}))),'text/csv')
  const lapsCsv=()=>downloadFile('question-laps.csv',toCsv(timer.sessions.flatMap(s=>s.laps.map(l=>({session:s.title,question:l.number,lap_seconds:(l.durationMs/1000).toFixed(2),total_active_seconds:(l.totalActiveMs/1000).toFixed(2),recorded_at:isoDate(l.recordedAt),invalid:String(l.invalid),note:l.note})))),'text/csv')
  const dailyCsv=()=>{const map=new Map<string,{date:string;questions:number;active_minutes:number}>();timer.sessions.forEach(s=>{const date=isoDate(s.startedAt).slice(0,10)||'unknown';const row=map.get(date)??{date,questions:0,active_minutes:0};row.questions+=validLaps(s).length;row.active_minutes+=activeTime(s)/60000;map.set(date,row)});downloadFile('daily-productivity.csv',toCsv([...map.values()].map(r=>({...r,active_minutes:r.active_minutes.toFixed(2)}))),'text/csv')}
  const modeCsv=()=>downloadFile('mode-productivity.csv',toCsv(timer.modes.map(m=>{const ss=timer.sessions.filter(s=>s.modeId===m.id);return{mode:m.name,sessions:ss.length,questions:ss.reduce((n,s)=>n+validLaps(s).length,0),active_minutes:(ss.reduce((n,s)=>n+activeTime(s),0)/60000).toFixed(2)}})),'text/csv')
  const choose=async(event:React.ChangeEvent<HTMLInputElement>)=>{const file=event.target.files?.[0];if(!file)return;try{const parsed:unknown=JSON.parse(await file.text());if(!validateBackup(parsed))throw new Error('This is not a valid Smart Question Timer backup.');setPending(parsed);setMessage('Backup validated. Choose Merge or Replace below.')}catch(error){setMessage((error as Error).message)}finally{event.target.value=''}}
  const restore=async(merge:boolean)=>{if(!pending)return;if(!merge)backup();await timer.restoreBackup(pending,merge);setPending(null);setMessage(merge?'Backup merged without duplicate session IDs.':'Current data replaced; a safety backup was downloaded first.')}
  return <><PageHeader eyebrow="You own your data" title="Backup & export" description="Everything stays on this device unless you explicitly download a file." action={<button className="button primary" onClick={backup}><Download size={18}/> Full JSON Backup</button>}/><div className="backup-grid"><Card className="backup-card"><Upload/><h2>Restore a backup</h2><p>Validate a Smart Question Timer JSON file, then merge it or replace current data.</p><input ref={input} type="file" accept="application/json,.json" hidden onChange={choose}/><button className="button secondary" onClick={()=>input.current?.click()}><Upload size={18}/> Choose JSON file</button>{pending&&<div className="restore-choice"><strong>{pending.sessions.length} sessions found</strong><button className="button secondary" onClick={()=>restore(true)}>Merge backup</button><button className="button danger-button" onClick={()=>restore(false)}>Replace current data</button></div>}</Card><Card className="backup-card"><Download/><h2>CSV exports</h2><p>Open focused reports in Excel, Google Sheets, or another spreadsheet tool.</p><div className="export-list"><button onClick={summaryCsv}>Session summary <ChevronRight/></button><button onClick={lapsCsv}>Question-level laps <ChevronRight/></button><button onClick={dailyCsv}>Daily productivity <ChevronRight/></button><button onClick={modeCsv}>Mode productivity <ChevronRight/></button></div></Card><Card className="privacy-card"><CloudOff/><div><h2>Browser storage</h2><p>Sessions, laps, pauses, modes, settings, targets, and the active-session reference are stored in IndexedDB. Clearing Chrome site data will remove them, so keep periodic backups.</p></div></Card></div>{message&&<div className="live-feedback visible" role="status">{message}</div>}</>
}

function RestorationDialog() {
  const timer=useTimer(); const navigate=useNavigate(); if(!timer.needsRestoration||!timer.activeSession)return null
  const last=timer.activeSession.laps.at(-1)?.recordedAt??timer.activeSession.startedAt
  return <Modal title="An unfinished session was found." onClose={()=>{}}><p><strong>{timer.activeSession.title}</strong> was still active when the app closed. Choose how to handle it.</p><div className="restoration-actions"><button className="button primary" onClick={()=>{timer.dismissRestoration();navigate('/active')}}><Play size={18}/> Resume Session</button><button className="button secondary" onClick={async()=>{const done=await timer.finishSession(last);if(done)navigate(`/summary/${done.id}`)}}><Check size={18}/> Finish at Last Recorded Time</button><button className="button danger-ghost" onClick={async()=>{await timer.discardActive();navigate('/')}}><Trash2 size={18}/> Discard Session</button></div></Modal>
}

function Loading(){return <div className="loading-screen"><div className="brand-mark"><TimerReset/></div><span>Opening your local workspace…</span></div>}

function AppRoutes(){const timer=useTimer();if(!timer.loaded)return <Loading/>;return <HashRouter><Routes><Route element={<Layout/>}><Route index element={<Dashboard/>}/><Route path="new" element={<NewSession/>}/><Route path="active" element={<ActiveSession/>}/><Route path="summary/:id" element={<SessionSummary/>}/><Route path="history" element={<SessionHistory/>}/><Route path="analytics" element={<Analytics/>}/><Route path="modes" element={<WorkModes/>}/><Route path="targets" element={<TargetsRecords/>}/><Route path="settings" element={<SettingsPage/>}/><Route path="backup" element={<BackupExport/>}/><Route path="*" element={<Navigate to="/" replace/>}/></Route></Routes><RestorationDialog/></HashRouter>}

export default function App(){return <AppRoutes/>}
