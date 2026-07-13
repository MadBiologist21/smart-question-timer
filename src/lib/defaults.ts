import type { UserSettings, WorkMode } from '../types'

export const defaultModes: WorkMode[] = [
  ['creation', 'Creation', 'Sparkles', '#0f766e'],
  ['uploading', 'Uploading', 'Upload', '#2563eb'],
  ['solving', 'Solving', 'Brain', '#7c3aed'],
  ['discrepancy', 'Discrepancy Checking', 'SearchCheck', '#d97706'],
  ['send-back', 'Send Back to Creator', 'Send', '#db2777'],
  ['review', 'Review', 'ScanSearch', '#0891b2'],
  ['correction', 'Correction', 'PencilLine', '#dc2626'],
  ['custom', 'Custom Mode', 'Shapes', '#64748b'],
].map(([id, name, icon, color]) => ({ id, name, icon, color, builtIn: true, createdAt: 0 }))

export const defaultSettings: UserSettings = {
  defaultModeId: 'creation', defaultTarget: 50, theme: 'system', showMilliseconds: false,
  soundFeedback: false, visualFeedback: true, desktopNotifications: false, idleWarningMinutes: 0,
  keyboardShortcuts: true, floatingMode: 'standard', floatingStats: true, dateFormat: 'short',
  clockFormat: '12', startOfWeek: 'monday', minimumLapCount: 5, backupReminders: false, dailyTarget: 50,
}
