import type { QuestionLap, WorkSession } from '../types'

export function pauseDuration(session: WorkSession, at = Date.now()): number {
  return (session.pauses ?? []).reduce((sum, pause) => sum + Math.max(0, (pause.endedAt ?? at) - pause.startedAt), 0)
}

export function elapsedTime(session: WorkSession, at = Date.now()): number {
  const startedAt = Number.isFinite(session.startedAt) ? session.startedAt : (session.createdAt || at)
  return Math.max(0, (session.finishedAt ?? at) - startedAt)
}

export function activeTime(session: WorkSession, at = Date.now()): number {
  return Math.max(0, elapsedTime(session, at) - pauseDuration(session, at))
}

export function validLaps(session: WorkSession): QuestionLap[] {
  return (session.laps ?? []).filter((lap) => !lap.invalid)
}

export function averageTime(session: WorkSession, at = Date.now()): number | null {
  const count = validLaps(session).length
  return count ? activeTime(session, at) / count : null
}

export function questionsPerHour(session: WorkSession, at = Date.now()): number {
  const hours = activeTime(session, at) / 3_600_000
  return hours > 0 ? validLaps(session).length / hours : 0
}

export function medianTime(session: WorkSession): number | null {
  const values = validLaps(session).map((lap) => lap.durationMs).sort((a, b) => a - b)
  if (!values.length) return null
  const middle = Math.floor(values.length / 2)
  return values.length % 2 ? values[middle] : (values[middle - 1] + values[middle]) / 2
}

export function fastestLap(session: WorkSession): QuestionLap | null {
  return validLaps(session).reduce<QuestionLap | null>((best, lap) => !best || lap.durationMs < best.durationMs ? lap : best, null)
}

export function slowestLap(session: WorkSession): QuestionLap | null {
  return validLaps(session).reduce<QuestionLap | null>((best, lap) => !best || lap.durationMs > best.durationMs ? lap : best, null)
}

export function completionPercent(session: WorkSession): number | null {
  if (!session.targetQuestions) return null
  return Math.min(100, validLaps(session).length / session.targetQuestions * 100)
}

export function estimatedRemainingTime(session: WorkSession, at = Date.now()): number | null {
  const average = averageTime(session, at)
  if (average == null || !session.targetQuestions) return null
  return Math.max(0, session.targetQuestions - validLaps(session).length) * average
}

export function longestPause(session: WorkSession, at = Date.now()): number {
  return (session.pauses ?? []).reduce((max, pause) => Math.max(max, (pause.endedAt ?? at) - pause.startedAt), 0)
}

export function speedTrend(session: WorkSession): 'Faster' | 'Slower' | 'Steady' | 'Not enough data' {
  const laps = validLaps(session)
  if (laps.length < 5) return 'Not enough data'
  const split = Math.floor(laps.length / 2)
  const mean = (items: QuestionLap[]) => items.reduce((sum, lap) => sum + lap.durationMs, 0) / items.length
  const first = mean(laps.slice(0, split))
  const last = mean(laps.slice(-split))
  if (last < first * 0.95) return 'Faster'
  if (last > first * 1.05) return 'Slower'
  return 'Steady'
}

export function formatDuration(ms: number | null, milliseconds = false): string {
  if (ms == null || !Number.isFinite(ms)) return '—'
  const safe = Math.max(0, ms)
  const hours = Math.floor(safe / 3_600_000)
  const minutes = Math.floor((safe % 3_600_000) / 60_000)
  const seconds = Math.floor((safe % 60_000) / 1_000)
  const base = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
  return milliseconds ? `${base}.${String(Math.floor(safe % 1_000 / 10)).padStart(2, '0')}` : base
}

export function formatLap(ms: number | null): string {
  if (ms == null || !Number.isFinite(ms)) return '—'
  const minutes = Math.floor(ms / 60_000)
  const seconds = Math.floor((ms % 60_000) / 1_000)
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

export function canRecord(lastRecordedAt: number | null, now: number, cooldown = 300): boolean {
  return lastRecordedAt == null || now - lastRecordedAt >= cooldown
}

export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  return ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || Boolean(target.isContentEditable)
}
