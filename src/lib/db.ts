import { openDB, type DBSchema } from 'idb'
import type { DailyTarget, PersonalRecord, QuestionLap, UserSettings, WorkMode, WorkSession } from '../types'

interface TimerDB extends DBSchema {
  sessions: { key: string; value: WorkSession }
  laps: { key: string; value: QuestionLap; indexes: { 'by-session': string } }
  modes: { key: string; value: WorkMode }
  settings: { key: string; value: UserSettings }
  targets: { key: string; value: DailyTarget }
  records: { key: string; value: PersonalRecord }
  meta: { key: string; value: unknown }
}

const database = openDB<TimerDB>('smart-question-timer', 2, {
  upgrade(db) {
    if (!db.objectStoreNames.contains('sessions')) db.createObjectStore('sessions', { keyPath: 'id' })
    if (!db.objectStoreNames.contains('laps')) {
      const laps = db.createObjectStore('laps', { keyPath: 'id' })
      laps.createIndex('by-session', 'sessionId')
    }
    if (!db.objectStoreNames.contains('modes')) db.createObjectStore('modes', { keyPath: 'id' })
    if (!db.objectStoreNames.contains('settings')) db.createObjectStore('settings')
    if (!db.objectStoreNames.contains('targets')) db.createObjectStore('targets', { keyPath: 'id' })
    if (!db.objectStoreNames.contains('records')) db.createObjectStore('records', { keyPath: 'id' })
    if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta')
  },
})

export async function loadAll() {
  const db = await database
  const [storedSessions, modes, settings, targets, records, activeSessionId] = await Promise.all([
    db.getAll('sessions'), db.getAll('modes'), db.get('settings', 'user'), db.getAll('targets'), db.getAll('records'), db.get('meta', 'activeSessionId'),
  ])
  const finite = (value: unknown) => Number.isFinite(Number(value)) ? Number(value) : Number.NaN
  const sessions = storedSessions.filter((session) => session && typeof session.id === 'string' && typeof session.title === 'string').map((session) => {
    const createdAt = finite(session.createdAt)
    const startedAt = Number.isFinite(finite(session.startedAt)) ? finite(session.startedAt) : createdAt
    const laps = (Array.isArray(session.laps) ? session.laps : []).map((lap, index) => ({ ...lap, number: Number(lap.number) || index + 1, recordedAt: finite(lap.recordedAt), durationMs: Number.isFinite(Number(lap.durationMs)) ? Number(lap.durationMs) : 0, totalActiveMs: Number.isFinite(Number(lap.totalActiveMs)) ? Number(lap.totalActiveMs) : 0, invalid: Boolean(lap.invalid), note: lap.note || '' }))
    const pauses = (Array.isArray(session.pauses) ? session.pauses : []).map((pause) => ({ ...pause, startedAt: finite(pause.startedAt), endedAt: Number.isFinite(finite(pause.endedAt)) ? finite(pause.endedAt) : undefined }))
    return { ...session, startedAt, finishedAt: Number.isFinite(finite(session.finishedAt)) ? finite(session.finishedAt) : undefined, createdAt, updatedAt: Number.isFinite(finite(session.updatedAt)) ? finite(session.updatedAt) : startedAt, laps, pauses }
  })
  return { sessions, modes, settings, targets, records, activeSessionId: typeof activeSessionId === 'string' ? activeSessionId : null }
}

export async function saveSession(session: WorkSession) {
  const db = await database
  const tx = db.transaction(['sessions', 'laps'], 'readwrite')
  await tx.objectStore('sessions').put(session)
  const index = tx.objectStore('laps').index('by-session')
  let cursor = await index.openCursor(session.id)
  while (cursor) { await cursor.delete(); cursor = await cursor.continue() }
  for (const lap of session.laps) await tx.objectStore('laps').put(lap)
  await tx.done
}

export async function addLapAtomic(session: WorkSession, lap: QuestionLap) {
  const db = await database
  const tx = db.transaction(['sessions', 'laps'], 'readwrite')
  await tx.objectStore('sessions').put(session)
  await tx.objectStore('laps').add(lap)
  await tx.done
}

export async function deleteSessionDb(id: string) {
  const db = await database
  const tx = db.transaction(['sessions', 'laps'], 'readwrite')
  await tx.objectStore('sessions').delete(id)
  const index = tx.objectStore('laps').index('by-session')
  let cursor = await index.openCursor(id)
  while (cursor) { await cursor.delete(); cursor = await cursor.continue() }
  await tx.done
}

export async function saveModes(modes: WorkMode[]) {
  const db = await database
  const tx = db.transaction('modes', 'readwrite')
  await tx.store.clear()
  for (const mode of modes) await tx.store.put(mode)
  await tx.done
}

export async function saveSettings(settings: UserSettings) { (await database).put('settings', settings, 'user') }
export async function setActiveSession(id: string | null) { (await database).put('meta', id, 'activeSessionId') }

export async function replaceAll(data: { sessions: WorkSession[]; modes: WorkMode[]; settings: UserSettings; targets: DailyTarget[]; records: PersonalRecord[] }) {
  const db = await database
  const stores: Array<'sessions' | 'laps' | 'modes' | 'settings' | 'targets' | 'records' | 'meta'> = ['sessions', 'laps', 'modes', 'settings', 'targets', 'records', 'meta']
  const tx = db.transaction(stores, 'readwrite')
  for (const name of stores) await tx.objectStore(name).clear()
  for (const session of data.sessions) {
    await tx.objectStore('sessions').put(session)
    for (const lap of session.laps) await tx.objectStore('laps').put(lap)
  }
  for (const mode of data.modes) await tx.objectStore('modes').put(mode)
  await tx.objectStore('settings').put(data.settings, 'user')
  for (const target of data.targets) await tx.objectStore('targets').put(target)
  for (const record of data.records) await tx.objectStore('records').put(record)
  await tx.done
}
