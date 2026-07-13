import type { BackupPayload, WorkSession } from '../types'

export function validateBackup(value: unknown): value is BackupPayload {
  if (!value || typeof value !== 'object') return false
  const data = value as Partial<BackupPayload>
  return data.version === 1 && data.app === 'smart-question-timer' && Array.isArray(data.sessions) &&
    Array.isArray(data.modes) && !!data.settings && typeof data.settings === 'object' &&
    data.sessions.every((session) => typeof session.id === 'string' && Array.isArray(session.laps) && Array.isArray(session.pauses))
}

export function mergeSessions(existing: WorkSession[], incoming: WorkSession[]): WorkSession[] {
  const map = new Map(existing.map((session) => [session.id, session]))
  for (const session of incoming) if (!map.has(session.id)) map.set(session.id, session)
  return [...map.values()]
}

export function toCsv(rows: Array<Record<string, string | number>>) {
  if (!rows.length) return ''
  const keys = Object.keys(rows[0])
  const cell = (value: string | number) => `"${String(value).replaceAll('"', '""')}"`
  return [keys.map(cell).join(','), ...rows.map((row) => keys.map((key) => cell(row[key])).join(','))].join('\r\n')
}

export function downloadFile(name: string, contents: string, type: string) {
  const url = URL.createObjectURL(new Blob([contents], { type }))
  const anchor = document.createElement('a')
  anchor.href = url; anchor.download = name; anchor.click()
  URL.revokeObjectURL(url)
}
