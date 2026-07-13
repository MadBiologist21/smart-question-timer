export type SessionStatus = 'active' | 'paused' | 'completed' | 'unfinished'
export type Theme = 'light' | 'dark' | 'system'

export interface WorkMode {
  id: string
  name: string
  icon: string
  color: string
  builtIn: boolean
  createdAt: number
}

export interface QuestionLap {
  id: string
  sessionId: string
  number: number
  recordedAt: number
  durationMs: number
  totalActiveMs: number
  note: string
  invalid: boolean
}

export interface PausePeriod {
  id: string
  sessionId: string
  startedAt: number
  endedAt?: number
  reason?: string
}

export interface WorkSession {
  id: string
  title: string
  modeId: string
  project: string
  subject: string
  targetQuestions?: number
  expectedDurationMinutes?: number
  notes: string
  startedAt: number
  finishedAt?: number
  status: SessionStatus
  laps: QuestionLap[]
  pauses: PausePeriod[]
  createdAt: number
  updatedAt: number
}

export interface UserSettings {
  defaultModeId: string
  defaultTarget: number
  theme: Theme
  showMilliseconds: boolean
  soundFeedback: boolean
  visualFeedback: boolean
  desktopNotifications: boolean
  idleWarningMinutes: number
  keyboardShortcuts: boolean
  floatingMode: 'standard' | 'micro'
  floatingStats: boolean
  dateFormat: 'short' | 'long'
  clockFormat: '12' | '24'
  startOfWeek: 'monday' | 'sunday'
  minimumLapCount: number
  backupReminders: boolean
  dailyTarget: number
}

export interface DailyTarget {
  id: string
  date: string
  targetQuestions: number
}

export interface PersonalRecord {
  id: string
  type: string
  value: number
  sessionId: string
  achievedAt: number
}

export interface BackupPayload {
  version: 1
  exportedAt: number
  app: 'smart-question-timer'
  sessions: WorkSession[]
  modes: WorkMode[]
  settings: UserSettings
  targets: DailyTarget[]
  records: PersonalRecord[]
}
