import { describe, expect, it } from 'vitest'
import { activeTime, averageTime, canRecord, completionPercent, estimatedRemainingTime, fastestLap, isTypingTarget, medianTime, questionsPerHour, slowestLap, validLaps } from '../lib/calculations'
import { mergeSessions, validateBackup } from '../lib/backup'
import { withoutLap, withoutLatestLap } from '../store/TimerContext'
import { createFloatingViewModel } from '../hooks/useFloatingTimer'
import { defaultSettings } from '../lib/defaults'
import type { BackupPayload, QuestionLap, WorkSession } from '../types'

const startedAt = 1_000_000
const lap = (number: number, durationMs: number, totalActiveMs: number, invalid = false): QuestionLap => ({
  id: `lap-${number}`, sessionId: 'session-1', number, durationMs, totalActiveMs,
  recordedAt: startedAt + totalActiveMs, note: '', invalid,
})

function session(overrides: Partial<WorkSession> = {}): WorkSession {
  return {
    id: 'session-1', title: 'Test session', modeId: 'creation', project: '', subject: '', targetQuestions: 10,
    expectedDurationMinutes: 60, notes: '', startedAt, finishedAt: startedAt + 600_000, status: 'completed',
    laps: [lap(1, 60_000, 60_000), lap(2, 120_000, 180_000), lap(3, 180_000, 360_000)],
    pauses: [{ id: 'pause-1', sessionId: 'session-1', startedAt: startedAt + 400_000, endedAt: startedAt + 460_000 }],
    createdAt: startedAt, updatedAt: startedAt + 600_000, ...overrides,
  }
}

describe('productivity calculations', () => {
  it('calculates average from total active time and valid questions', () => expect(averageTime(session())).toBe(180_000))
  it('calculates questions per active hour', () => expect(questionsPerHour(session())).toBe(20))
  it('excludes pauses from active time', () => expect(activeTime(session())).toBe(540_000))
  it('calculates the median question time', () => expect(medianTime(session())).toBe(120_000))
  it('finds fastest and slowest valid questions', () => { expect(fastestLap(session())?.id).toBe('lap-1'); expect(slowestLap(session())?.id).toBe('lap-3') })
  it('undoes the latest recorded lap', () => expect(withoutLatestLap(session()).laps.map((item) => item.id)).toEqual(['lap-1', 'lap-2']))
  it('deletes a selected lap and renumbers the remainder', () => expect(withoutLap(session(), 'lap-2').laps.map((item) => [item.id, item.number])).toEqual([['lap-1', 1], ['lap-3', 2]]))
  it('excludes invalid laps from counts and statistics', () => { const data = session({ laps: [lap(1, 60_000, 60_000), lap(2, 120_000, 180_000, true)] }); expect(validLaps(data)).toHaveLength(1); expect(questionsPerHour(data)).toBeCloseTo(6.666, 2) })
  it('calculates target completion', () => expect(completionPercent(session())).toBe(30))
  it('estimates remaining time using the current average', () => expect(estimatedRemainingTime(session())).toBe(1_260_000))
  it('restores active elapsed time from exact timestamps after a restart', () => {
    const active = session({ status: 'active', finishedAt: undefined, laps: [], pauses: [] })
    expect(activeTime(active, startedAt + 900_000)).toBe(900_000)
  })
  it('enforces the 300 ms duplicate-lap cooldown', () => { expect(canRecord(1_000, 1_299)).toBe(false); expect(canRecord(1_000, 1_300)).toBe(true) })
})

describe('backup safety', () => {
  const payload: BackupPayload = { version: 1, exportedAt: Date.now(), app: 'smart-question-timer', sessions: [session()], modes: [], settings: defaultSettings, targets: [], records: [] }
  it('validates a well-formed backup and rejects an invalid one', () => { expect(validateBackup(payload)).toBe(true); expect(validateBackup({ version: 99 })).toBe(false) })
  it('prevents duplicate session IDs while merging', () => expect(mergeSessions([session()], [session(), session({ id: 'session-2' })])).toHaveLength(2))
})

describe('shared UI state and shortcuts', () => {
  it('builds floating timer data from the same active session', () => expect(createFloatingViewModel(session(), 540_000, 180_000, 20).sessionId).toBe('session-1'))
  it('ignores shortcuts while typing', () => { const input = document.createElement('input'); const div = document.createElement('div'); expect(isTypingTarget(input)).toBe(true); expect(isTypingTarget(div)).toBe(false) })
  it('ignores shortcuts in content-editable elements', () => { const div = document.createElement('div'); Object.defineProperty(div, 'isContentEditable', { value: true }); expect(isTypingTarget(div)).toBe(true) })
})
