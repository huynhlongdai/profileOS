import { EventEmitter } from 'node:events'
import type { Log } from '@prisma/client'

/**
 * LogEmitter - A simple singleton to broadcast logs across the system
 */
class LogEmitter extends EventEmitter {
  private static instance: LogEmitter

  private constructor() {
    super()
    this.setMaxListeners(100) // Increase limit for many SSE connections
  }

  static getInstance(): LogEmitter {
    if (!LogEmitter.instance) {
      LogEmitter.instance = new LogEmitter()
    }
    return LogEmitter.instance
  }

  /**
   * Broadcast a new log
   */
  emitLog(log: Log): void {
    this.emit('new-log', log)
  }

  /**
   * Subscribe to new logs
   */
  onLog(callback: (log: Log) => void): () => void {
    this.on('new-log', callback)
    return () => this.off('new-log', callback)
  }
}

export const logEmitter = LogEmitter.getInstance()
