/**
 * API Route for replaying a recording
 * 
 * POST /api/recordings/[id]/replay - Replay a recording
 */

import { NextRequest, NextResponse } from 'next/server'
import { ActionRecordingService } from '@/core/services/ActionRecordingService'
import { ActionReplayer } from '@/core/record/ActionReplayer'
import { PlaywrightBrowserController } from '@/integrations/BrowserController'
import { ProfileService } from '@/core/services/ProfileService'

const recordingService = new ActionRecordingService()
const browserController = new PlaywrightBrowserController()
const profileService = new ProfileService()

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json()
    const { accountId, profileId, options } = body

    // Get recording
    const recording = await recordingService.getRecordingById(params.id)
    if (!recording) {
      return NextResponse.json({ error: 'Recording not found' }, { status: 404 })
    }

    // Create run record
    const run = await recordingService.createRun(params.id, {
      accountId,
      profileId,
    })

    // Start profile if profileId is provided
    let host: string | undefined
    let port: number | undefined

    if (profileId) {
      try {
        const profileInfo = await profileService.ensureProfileRunning(profileId)
        host = profileInfo.host
        port = profileInfo.port
      } catch (error) {
        await recordingService.updateRun(run.id, {
          status: 'failed',
          errorMessage: `Failed to start profile: ${error instanceof Error ? error.message : 'Unknown error'}`,
        })
        return NextResponse.json(
          { error: 'Failed to start profile', runId: run.id },
          { status: 500 }
        )
      }
    } else if (accountId) {
      // Get account's profile
      const { prisma } = await import('@/lib/prisma')
      const account = await prisma.account.findUnique({
        where: { id: accountId },
        include: { profile: true },
      })

      if (account?.profile) {
        try {
          const profileInfo = await profileService.ensureProfileRunning(account.profile.id)
          host = profileInfo.host
          port = profileInfo.port
        } catch (error) {
          await recordingService.updateRun(run.id, {
            status: 'failed',
            errorMessage: `Failed to start profile: ${error instanceof Error ? error.message : 'Unknown error'}`,
          })
          return NextResponse.json(
            { error: 'Failed to start profile', runId: run.id },
            { status: 500 }
          )
        }
      }
    }

    if (!host || !port) {
      await recordingService.updateRun(run.id, {
        status: 'failed',
        errorMessage: 'No profile available for replay',
      })
      return NextResponse.json(
        { error: 'No profile available. Please provide accountId or profileId.' },
        { status: 400 }
      )
    }

    // Connect to browser
    let session
    try {
      session = await browserController.connectByRemoteDebugging(host, port)
    } catch (error) {
      await recordingService.updateRun(run.id, {
        status: 'failed',
        errorMessage: `Failed to connect to browser: ${error instanceof Error ? error.message : 'Unknown error'}`,
      })
      return NextResponse.json(
        { error: 'Failed to connect to browser', runId: run.id },
        { status: 500 }
      )
    }

    try {
      // Get or create page
      const browser = (session as any).getBrowser()
      const context = (session as any).getContext()
      if (!context) {
        throw new Error('Browser context not available')
      }

      const pages = context.pages()
      let page = pages.length > 0 ? pages[0] : await context.newPage()

      // Create replayer
      const replayer = new ActionReplayer(page, {
        speedMultiplier: options?.speedMultiplier || 1.0,
        stopOnError: options?.stopOnError !== false,
        retryOnError: options?.retryOnError || false,
        retryCount: options?.retryCount || 3,
        retryDelay: options?.retryDelay || 1000,
        skipWaitActions: options?.skipWaitActions || false,
        logActions: options?.logActions !== false,
      })

      // Track progress
      const logs: any[] = []
      replayer.onProgressCallback((progress) => {
        logs.push({
          timestamp: Date.now(),
          current: progress.current,
          total: progress.total,
          actionType: progress.action.type,
          status: progress.status,
        })

        // Update run progress
        recordingService.updateRun(run.id, {
          currentActionIndex: progress.current,
          successfulActions: progress.status === 'completed' ? progress.current : undefined,
        }).catch((err) => {
          console.error('Error updating run progress:', err)
        })
      })

      // Replay recording
      const result = await replayer.replay(recording)

      // Update run with results
      await recordingService.updateRun(run.id, {
        status: result.success ? 'completed' : 'failed',
        currentActionIndex: result.actionsExecuted + result.actionsFailed,
        successfulActions: result.actionsExecuted,
        failedActions: result.actionsFailed,
        errorMessage: result.errors.length > 0 ? JSON.stringify(result.errors) : undefined,
        logs,
      })

      return NextResponse.json({
        success: result.success,
        runId: run.id,
        actionsExecuted: result.actionsExecuted,
        actionsFailed: result.actionsFailed,
        errors: result.errors,
        durationMs: result.durationMs,
      })
    } catch (error) {
      await recordingService.updateRun(run.id, {
        status: 'failed',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
      })

      return NextResponse.json(
        {
          error: error instanceof Error ? error.message : 'Replay failed',
          runId: run.id,
        },
        { status: 500 }
      )
    } finally {
      // Close session (but don't stop profile)
      await session.close()
    }
  } catch (error) {
    console.error('[API] Error replaying recording:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to replay recording' },
      { status: 500 }
    )
  }
}

