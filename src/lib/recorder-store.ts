import WebSocket from 'ws'

export interface RecordedAction {
  timestamp: number
  action: string
  params: Record<string, unknown>
  label: string
  xpath?: string
  selector?: string
}

export interface RecordingSession {
  id: string
  debugPort: number
  startedAt: number
  actions: RecordedAction[]
  status: 'recording' | 'paused' | 'stopped'
  ws?: WebSocket
  pollInterval?: ReturnType<typeof setInterval>
}

// Global singleton for recording sessions
const globalForRecorder = globalThis as unknown as {
  recorderSessions?: Map<string, RecordingSession>
}

if (!globalForRecorder.recorderSessions) {
  globalForRecorder.recorderSessions = new Map()
}

export const sessions = globalForRecorder.recorderSessions
