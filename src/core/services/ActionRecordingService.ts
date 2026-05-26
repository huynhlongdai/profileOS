/**
 * ActionRecordingService - Service for managing action recordings
 * 
 * Handles CRUD operations for action recordings in the database
 */

import { prisma } from '@/lib/prisma'
import { ActionRecording as ActionRecordingType, Action } from '../record/ActionTypes'

export interface CreateRecordingInput {
  name: string
  description?: string
  accountType?: string
  url?: string
  version?: string
  author?: string
  tags?: string[]
  actions: Action[]
  config?: {
    defaultTimeout?: number
    screenshotOnError?: boolean
    retryOnFailure?: boolean
  }
}

export interface UpdateRecordingInput {
  name?: string
  description?: string
  accountType?: string
  url?: string
  version?: string
  author?: string
  tags?: string[]
  actions?: Action[]
  config?: {
    defaultTimeout?: number
    screenshotOnError?: boolean
    retryOnFailure?: boolean
  }
  status?: 'draft' | 'published' | 'archived'
}

export class ActionRecordingService {
  /**
   * Create a new recording
   */
  async createRecording(input: CreateRecordingInput) {
    const recordingData: ActionRecordingType = {
      version: input.version || '1.0.0',
      metadata: {
        name: input.name,
        description: input.description,
        accountType: input.accountType,
        url: input.url,
        author: input.author,
        tags: input.tags || [],
        version: input.version || '1.0.0',
      },
      actions: input.actions,
      config: input.config,
    }

    // Calculate duration from actions
    const durationMs =
      input.actions.length > 0
        ? input.actions[input.actions.length - 1].timestamp
        : 0

    const recording = await prisma.actionRecording.create({
      data: {
        name: input.name,
        description: input.description,
        accountType: input.accountType,
        url: input.url,
        version: input.version || '1.0.0',
        author: input.author,
        tags: input.tags ? JSON.stringify(input.tags) : null,
        actionsJson: JSON.stringify(recordingData),
        actionCount: input.actions.length,
        durationMs: durationMs > 0 ? durationMs : null,
        status: 'draft',
      },
    })

    return {
      ...recording,
      actions: input.actions,
      metadata: recordingData.metadata,
      config: recordingData.config,
    }
  }

  /**
   * Get recording by ID
   */
  async getRecordingById(id: string) {
    const recording = await prisma.actionRecording.findUnique({
      where: { id },
      include: {
        runs: {
          orderBy: { startedAt: 'desc' },
          take: 10, // Last 10 runs
        },
      },
    })

    if (!recording) {
      return null
    }

    return this.parseRecording(recording)
  }

  /**
   * List all recordings with filters
   */
  async listRecordings(filters?: {
    accountType?: string
    status?: 'draft' | 'published' | 'archived'
    search?: string
    limit?: number
    offset?: number
  }) {
    const where: any = {}

    if (filters?.accountType) {
      where.accountType = filters.accountType
    }

    if (filters?.status) {
      where.status = filters.status
    }

    if (filters?.search) {
      where.OR = [
        { name: { contains: filters.search } },
        { description: { contains: filters.search } },
      ]
    }

    const [recordings, total] = await Promise.all([
      prisma.actionRecording.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: filters?.limit || 50,
        skip: filters?.offset || 0,
        include: {
          _count: {
            select: { runs: true },
          },
        },
      }),
      prisma.actionRecording.count({ where }),
    ])

    return {
      recordings: recordings.map((r) => ({
        id: r.id,
        name: r.name,
        description: r.description,
        accountType: r.accountType,
        url: r.url,
        version: r.version,
        author: r.author,
        tags: r.tags ? JSON.parse(r.tags) : [],
        actionCount: r.actionCount,
        durationMs: r.durationMs,
        status: r.status,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
        runCount: r._count.runs,
      })),
      total,
    }
  }

  /**
   * Update recording
   */
  async updateRecording(id: string, input: UpdateRecordingInput) {
    const existing = await prisma.actionRecording.findUnique({
      where: { id },
    })

    if (!existing) {
      throw new Error(`Recording with id ${id} not found`)
    }

    // Parse existing recording
    const existingRecording = this.parseRecording(existing)

    // Merge with new data
    const updatedRecording: ActionRecordingType = {
      version: input.version || existingRecording.version,
      metadata: {
        ...existingRecording.metadata,
        name: input.name || existingRecording.metadata.name,
        description: input.description !== undefined ? input.description : existingRecording.metadata.description,
        accountType: input.accountType !== undefined ? input.accountType : existingRecording.metadata.accountType,
        url: input.url !== undefined ? input.url : existingRecording.metadata.url,
        author: input.author !== undefined ? input.author : existingRecording.metadata.author,
        tags: input.tags || existingRecording.metadata.tags || [],
        version: input.version || existingRecording.metadata.version || '1.0.0',
      },
      actions: input.actions || existingRecording.actions,
      config: input.config || existingRecording.config,
    }

    // Calculate duration
    const actions = updatedRecording.actions
    const durationMs = actions.length > 0 ? actions[actions.length - 1].timestamp : 0

    const recording = await prisma.actionRecording.update({
      where: { id },
      data: {
        name: input.name,
        description: input.description,
        accountType: input.accountType,
        url: input.url,
        version: input.version,
        author: input.author,
        tags: input.tags ? JSON.stringify(input.tags) : existing.tags,
        actionsJson: JSON.stringify(updatedRecording),
        actionCount: actions.length,
        durationMs: durationMs > 0 ? durationMs : null,
        status: input.status || existing.status,
      },
    })

    return this.parseRecording(recording)
  }

  /**
   * Delete recording
   */
  async deleteRecording(id: string) {
    const recording = await prisma.actionRecording.findUnique({
      where: { id },
    })

    if (!recording) {
      throw new Error(`Recording with id ${id} not found`)
    }

    await prisma.actionRecording.delete({
      where: { id },
    })

    return { success: true }
  }

  /**
   * Create a recording run (track replay execution)
   */
  async createRun(recordingId: string, input: {
    accountId?: string
    profileId?: string
  }) {
    const recording = await prisma.actionRecording.findUnique({
      where: { id: recordingId },
    })

    if (!recording) {
      throw new Error(`Recording with id ${recordingId} not found`)
    }

    const run = await prisma.actionRecordingRun.create({
      data: {
        recordingId,
        accountId: input.accountId || null,
        profileId: input.profileId || null,
        status: 'running',
        totalActions: recording.actionCount,
        currentActionIndex: 0,
        successfulActions: 0,
        failedActions: 0,
      },
    })

    return run
  }

  /**
   * Update run status
   */
  async updateRun(
    runId: string,
    input: {
      status?: 'running' | 'completed' | 'failed' | 'paused'
      currentActionIndex?: number
      successfulActions?: number
      failedActions?: number
      errorMessage?: string
      logs?: any[]
    }
  ) {
    const updateData: any = {
      ...input,
    }

    if (input.status === 'completed' || input.status === 'failed') {
      const run = await prisma.actionRecordingRun.findUnique({
        where: { id: runId },
      })

      if (run) {
        updateData.completedAt = new Date()
        updateData.durationMs = Date.now() - run.startedAt.getTime()
      }
    }

    if (input.logs) {
      updateData.logsJson = JSON.stringify(input.logs)
    }

    const run = await prisma.actionRecordingRun.update({
      where: { id: runId },
      data: updateData,
    })

    return run
  }

  /**
   * Get run by ID
   */
  async getRunById(runId: string) {
    const run = await prisma.actionRecordingRun.findUnique({
      where: { id: runId },
      include: {
        recording: true,
      },
    })

    if (!run) {
      return null
    }

    return {
      ...run,
      logs: run.logsJson ? JSON.parse(run.logsJson) : null,
    }
  }

  /**
   * List runs for a recording
   */
  async listRuns(recordingId: string, filters?: {
    status?: string
    limit?: number
    offset?: number
  }) {
    const where: any = { recordingId }

    if (filters?.status) {
      where.status = filters.status
    }

    const [runs, total] = await Promise.all([
      prisma.actionRecordingRun.findMany({
        where,
        orderBy: { startedAt: 'desc' },
        take: filters?.limit || 50,
        skip: filters?.offset || 0,
      }),
      prisma.actionRecordingRun.count({ where }),
    ])

    return {
      runs: runs.map((r) => ({
        ...r,
        logs: r.logsJson ? JSON.parse(r.logsJson) : null,
      })),
      total,
    }
  }

  /**
   * Parse recording from database format
   */
  private parseRecording(recording: any): ActionRecordingType {
    const parsed = JSON.parse(recording.actionsJson)

    return {
      version: parsed.version || '1.0.0',
      metadata: {
        name: recording.name,
        description: recording.description || undefined,
        accountType: recording.accountType || undefined,
        url: recording.url || undefined,
        author: recording.author || undefined,
        tags: recording.tags ? JSON.parse(recording.tags) : [],
        version: recording.version || '1.0.0',
      },
      actions: parsed.actions || [],
      config: parsed.config,
    }
  }
}

