/**
 * API Route to test recording functionality
 * 
 * POST /api/recordings/test - Test recording with a real browser session
 * 
 * This endpoint allows you to test recording by:
 * 1. Connecting to a profile
 * 2. Starting recording
 * 3. Performing some test actions
 * 4. Saving the recording
 */

import { NextRequest, NextResponse } from 'next/server'
import { PlaywrightBrowserController } from '@/integrations/BrowserController'
import { ProfileService } from '@/core/services/ProfileService'
import { RecordingHelper } from '@/core/record/RecordingHelper'
import { AccountService } from '@/core/services/AccountService'

const browserController = new PlaywrightBrowserController()
const profileService = new ProfileService()
const accountService = new AccountService()

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { accountId, profileId, testUrl } = body

    // Get profile info
    let host: string
    let port: number
    let profileInfo: any

    try {
      if (profileId) {
        profileInfo = await profileService.ensureProfileRunning(profileId)
        host = profileInfo.host
        port = profileInfo.port
      } else if (accountId) {
        const { prisma } = await import('@/lib/prisma')
        const account = await prisma.account.findUnique({
          where: { id: accountId },
          include: { profile: true },
        })

        if (!account?.profile) {
          return NextResponse.json(
            {
              error: 'Account does not have a profile. Please provide profileId.',
              details: 'The selected account is not associated with any profile. Please select a profile or create one for this account.'
            },
            { status: 400 }
          )
        }

        profileInfo = await profileService.ensureProfileRunning(account.profile.id)
        host = profileInfo.host
        port = profileInfo.port
      } else {
        return NextResponse.json(
          { error: 'Please provide either accountId or profileId' },
          { status: 400 }
        )
      }
    } catch (error: any) {
      console.error('[Test Recording] Error starting profile:', error)

      // Check if it's a connection error
      if (error?.message?.includes('ECONNREFUSED') || error?.message?.includes('fetch failed')) {
        return NextResponse.json(
          {
            error: 'Cannot connect to GPMLogin service',
            details: 'GPMLogin service is not running or not accessible. Please ensure GPMLogin is running and the API port is correct (default: 19995).',
            troubleshooting: [
              '1. Check if GPMLogin application is running',
              '2. Verify GPMLogin API port in settings (default: 19995)',
              '3. Check firewall settings',
              '4. Try restarting GPMLogin application'
            ]
          },
          { status: 503 }
        )
      }

      // Generic error
      return NextResponse.json(
        {
          error: 'Failed to start profile',
          details: error?.message || 'Unknown error occurred while starting the profile',
          troubleshooting: [
            '1. Check if the profile exists',
            '2. Verify profile status',
            '3. Check GPMLogin connection',
            '4. Review server logs for more details'
          ]
        },
        { status: 500 }
      )
    }

    // Connect to browser
    let session
    try {
      session = await browserController.connectByRemoteDebugging(host, port)
    } catch (error: any) {
      console.error('[Test Recording] Error connecting to browser:', error)
      return NextResponse.json(
        {
          error: 'Cannot connect to browser',
          details: error?.message || 'Failed to connect to browser remote debugging port',
          troubleshooting: [
            '1. Ensure the profile is running correctly',
            '2. Check if remote debugging port is accessible',
            '3. Verify profile status in GPMLogin',
            '4. Try restarting the profile'
          ]
        },
        { status: 503 }
      )
    }

    const browser = (session as any).getBrowser()
    const context = (session as any).getContext()

    if (!context) {
      await session.close().catch(() => { })
      return NextResponse.json(
        {
          error: 'Browser context not available',
          troubleshooting: [
            '1. Profile may not be fully started yet',
            '2. Try waiting a few seconds and retry',
            '3. Check profile status'
          ]
        },
        { status: 500 }
      )
    }

    const pages = context.pages()
    let page = pages.length > 0 ? pages[0] : await context.newPage()

    try {
      // Collect metadata from profile/account (GPM Automate variables)
      let profileName: string | undefined
      let profileId: string | undefined
      let profileProxy: string | undefined
      let accountLabel: string | undefined
      let accountIdentifier: string | undefined
      let accountType: string | undefined

      // Get profile info
      const { prisma } = await import('@/lib/prisma')
      if (profileId) {
        const profile = await prisma.profile.findUnique({
          where: { id: profileId },
          include: { proxy: true },
        })
        if (profile) {
          profileName = profile.name
          profileId = profile.id
          profileProxy = profile.proxy?.rawProxy || undefined
        }
      } else if (accountId) {
        const account = await prisma.account.findUnique({
          where: { id: accountId },
          include: {
            profile: { include: { proxy: true } },
          },
        })
        if (account) {
          accountLabel = account.label
          accountIdentifier = account.identifier
          accountType = account.accountType
          if (account.profile) {
            profileName = account.profile.name
            profileId = account.profile.id
            profileProxy = account.profile.proxy?.rawProxy || undefined
          }
        }
      }

      // Start recording with metadata
      const helper = new RecordingHelper()
      const recordingSession = await helper.startRecording(page, {
        name: body.name || `Test Recording - ${new Date().toISOString()}`,
        description: body.description || 'Test recording from API endpoint',
        accountType: accountType || body.accountType,
        url: testUrl || 'https://www.google.com',
        tags: body.tags || ['test', 'api'],
      })

      console.log('[Test Recording] Started recording...')

      // Perform test actions
      const actions: string[] = []

      // 1. Navigate
      const targetUrl = testUrl || 'https://www.google.com'
      await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 30000 })
      recordingSession.recorder.addAction({
        type: 'navigate',
        url: targetUrl,
        description: `Navigate to ${targetUrl}`,
      } as any)
      actions.push(`Navigated to ${targetUrl}`)

      await page.waitForTimeout(2000)
      recordingSession.recorder.addAction({
        type: 'wait',
        duration: 2000,
        description: 'Wait for page load',
      } as any)
      actions.push('Waited 2 seconds')

      // 2. Try to find and interact with common elements (if on Google)
      if (targetUrl.includes('google.com')) {
        // Search for something
        const searchBox = await page.$('textarea[name="q"], input[name="q"]')
        if (searchBox) {
          await page.fill('textarea[name="q"], input[name="q"]', 'test recording')
          recordingSession.recorder.addAction({
            type: 'fill',
            selector: 'textarea[name="q"], input[name="q"]',
            value: 'test recording',
            description: 'Fill search box with "test recording"',
          } as any)
          actions.push('Filled search box')

          await page.waitForTimeout(500)
          recordingSession.recorder.addAction({
            type: 'wait',
            duration: 500,
            description: 'Wait before clicking search',
          } as any)
        }
      }

      // 3. Scroll
      await page.evaluate(() => window.scrollBy(0, 300))
      recordingSession.recorder.addAction({
        type: 'scroll',
        description: 'Scroll down 300px',
        options: {
          y: 300,
        },
      } as any)
      actions.push('Scrolled down')

      await page.waitForTimeout(1000)
      recordingSession.recorder.addAction({
        type: 'wait',
        duration: 1000,
        description: 'Wait after scroll',
      } as any)

      // 4. Take a screenshot (optional)
      recordingSession.recorder.addAction({
        type: 'screenshot',
        description: 'Take screenshot of test page',
      } as any)

      console.log('[Test Recording] Completed test actions:', actions)

      // Stop and save recording
      const recordingId = await recordingSession.stopAndSave()

      return NextResponse.json({
        success: true,
        recordingId,
        actionsPerformed: actions,
        message: 'Test recording completed successfully',
      })
    } catch (error: any) {
      console.error('[Test Recording] Error during recording:', error)

      // Close session if it exists
      try {
        if (session) {
          await session.close()
        }
      } catch (closeError) {
        console.error('[Test Recording] Error closing session:', closeError)
      }

      return NextResponse.json(
        {
          error: 'Error during recording process',
          details: error?.message || 'Unknown error occurred during recording',
          troubleshooting: [
            '1. Check browser connection',
            '2. Verify profile is running correctly',
            '3. Check network connectivity',
            '4. Review server logs for more details'
          ]
        },
        { status: 500 }
      )
    } finally {
      // Close session (but don't stop profile)
      try {
        if (session) {
          await session.close()
        }
      } catch (closeError) {
        console.error('[Test Recording] Error closing session in finally:', closeError)
      }
    }
  } catch (error: any) {
    console.error('[Test Recording] Outer catch error:', error)

    // This catch handles errors before session is created
    // Handle connection errors specifically
    if (error?.message?.includes('ECONNREFUSED') || error?.code === 'ECONNREFUSED' || error?.cause?.code === 'ECONNREFUSED') {
      return NextResponse.json(
        {
          error: 'Cannot connect to GPMLogin service',
          details: 'GPMLogin service is not running or not accessible at the configured port (default: 19995).',
          troubleshooting: [
            '1. Ensure GPMLogin application is running',
            '2. Check GPMLogin API port configuration (default: 19995)',
            '3. Verify firewall is not blocking the connection',
            '4. Try restarting GPMLogin application',
            '5. Check environment variable GPMLOGIN_API_URL matches your GPMLogin settings'
          ]
        },
        { status: 503 }
      )
    }

    return NextResponse.json(
      {
        error: 'Failed to start test recording',
        details: error?.message || 'Unknown error occurred',
        troubleshooting: [
          '1. Check server logs for detailed error information',
          '2. Verify all required services are running',
          '3. Check network connectivity'
        ]
      },
      { status: 500 }
    )
  }
}

