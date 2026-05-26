/**
 * Recording Example - Ví dụ cụ thể về cách sử dụng Recording Module
 * 
 * File này chứa các ví dụ thực tế về cách record browser actions
 */

import type { Page } from 'playwright'
import { RecordingHelper } from '@/core/record/RecordingHelper'
import type { BrowserSession, CoinGeckoCandyPageController } from '@/integrations/BrowserController'

/**
 * Ví dụ 1: Record CoinGecko Candy Claim Process
 */
export async function recordCoinGeckoCandyClaim(
  page: Page,
  accountId: string,
  googleEmail?: string
): Promise<string> {
  const helper = new RecordingHelper()
  const session = await helper.startRecording(page, {
    name: `CoinGecko Candy Claim - ${accountId}`,
    accountType: 'coingecko',
    description: 'Record CoinGecko candy claim process including login',
    url: 'https://www.coingecko.com/en/candy',
    tags: ['coingecko', 'candy', 'claim', 'login'],
  })

  try {
    // Navigate to candy page
    await page.goto('https://www.coingecko.com/en/candy', {
      waitUntil: 'domcontentloaded',
    })
    session.recorder.addAction({
      type: 'navigate',
      url: 'https://www.coingecko.com/en/candy',
      description: 'Navigate to CoinGecko Candy page',
    } as any) // Type assertion needed due to Omit<Action, 'id' | 'timestamp'> type narrowing

    // Wait for page load
    await page.waitForTimeout(2000)
    session.recorder.addAction({
      type: 'wait',
      duration: 2000,
      description: 'Wait for page to load',
    })

    // Check if logged in by looking for "Collect Candy" button
    const collectButton = await page.$('button#collectButton')
    const loginButton = await page.$('button[data-action="click->auth#openSignInModal"]')

    if (!collectButton && loginButton) {
      // Need to login
      session.recorder.addAction({
        type: 'click',
        selector: 'button[data-action="click->auth#openSignInModal"]',
        description: 'Click login button',
      })
      await page.click('button[data-action="click->auth#openSignInModal"]')

      // Wait for modal
      await page.waitForSelector('#auth-modal', { state: 'visible', timeout: 5000 })
      session.recorder.addAction({
        type: 'waitForSelector',
        selector: '#auth-modal',
        description: 'Wait for login modal to appear',
        options: {
          state: 'visible',
          timeout: 5000,
        },
      })

      // Click "Continue with Google"
      const googleButtonXPath = '//*[@id="auth-modal"]/div[3]/div/div[1]/div[4]/div/button[1]'
      session.recorder.addAction({
        type: 'click',
        selector: googleButtonXPath,
        description: 'Click Continue with Google button',
      })
      await page.click(googleButtonXPath)

      // Wait for Google OAuth page
      await page.waitForURL('**/accounts.google.com/**', { timeout: 10000 })
      session.recorder.addAction({
        type: 'waitForNavigation',
        description: 'Wait for Google OAuth page',
        options: {
          url: '**/accounts.google.com/**',
          waitUntil: 'domcontentloaded',
          timeout: 10000,
        },
      })

      // Select Google account if needed
      if (googleEmail) {
        // Try to find and click the account
        const accountSelector = `text="${googleEmail}"`
        const accountExists = await page.$(accountSelector)
        if (accountExists) {
          session.recorder.addAction({
            type: 'click',
            selector: accountSelector,
            description: `Select Google account: ${googleEmail}`,
          })
          await page.click(accountSelector)
        }
      }

      // Wait for redirect back to CoinGecko
      await page.waitForURL('**/coingecko.com/**', { timeout: 30000 })
      session.recorder.addAction({
        type: 'waitForNavigation',
        description: 'Wait for redirect back to CoinGecko',
        options: {
          url: '**/coingecko.com/**',
          waitUntil: 'domcontentloaded',
          timeout: 30000,
        },
      })
    }

    // Wait a bit for page to settle
    await page.waitForTimeout(2000)
    session.recorder.addAction({
      type: 'wait',
      duration: 2000,
      description: 'Wait for page to settle after login',
    })

    // Click "Collect Candy" button
    await page.waitForSelector('button#collectButton', { state: 'visible', timeout: 10000 })
    session.recorder.addAction({
      type: 'waitForSelector',
      selector: 'button#collectButton',
      description: 'Wait for Collect Candy button',
      options: {
        state: 'visible',
        timeout: 10000,
      },
    })

    session.recorder.addAction({
      type: 'click',
      selector: 'button#collectButton',
      description: 'Click Collect Candy button',
    })
    await page.click('button#collectButton')

    // Wait for candy to be collected
    await page.waitForTimeout(3000)
    session.recorder.addAction({
      type: 'wait',
      duration: 3000,
      description: 'Wait for candy collection confirmation',
    })

    console.log('[Recording] CoinGecko candy claim recorded successfully')
  } catch (error) {
    console.error('[Recording] Error during recording:', error)
    throw error
  } finally {
    const recordingId = await session.stopAndSave()
    console.log(`[Recording] Recording saved with ID: ${recordingId}`)
    return recordingId
  }
}

/**
 * Ví dụ 2: Record với wrapAction (Tự động ghi lại)
 */
export async function recordWithWrapAction(page: Page, accountId: string): Promise<string> {
  const helper = new RecordingHelper()
  const session = await helper.startRecording(page, {
    name: `Auto Recorded Flow - ${accountId}`,
    accountType: 'gmail',
    description: 'Example using wrapAction for automatic recording',
  })

  // Create wrapped actions
  const click = helper.wrapAction(page, session.recorder, 'click')
  const fill = helper.wrapAction(page, session.recorder, 'fill')
  const type = helper.wrapAction(page, session.recorder, 'type')

  try {
    // Navigate
    await page.goto('https://example.com')
    session.recorder.addAction({
      type: 'navigate',
      url: 'https://example.com',
      description: 'Navigate to example.com',
    })

    // Use wrapped actions (automatically recorded)
    await fill('input.email', { value: 'test@example.com' }, 'Enter email')
    await type('input.password', { text: 'password123', delay: 100 }, 'Type password')
    await click('button.login', {}, 'Click login button')

    // Wait
    await page.waitForTimeout(2000)
    session.recorder.addAction({
      type: 'wait',
      duration: 2000,
      description: 'Wait after login',
    })

  } finally {
    const recordingId = await session.stopAndSave()
    return recordingId
  }
}

/**
 * Ví dụ 3: Record trong Service với Optional Recording
 */
export class ExampleServiceWithRecording {
  async performAction(
    page: Page,
    options?: { enableRecording?: boolean; recordingName?: string }
  ): Promise<string | null> {
    let recordingSession: Awaited<ReturnType<RecordingHelper['startRecording']>> | null = null

    // Start recording if enabled
    if (options?.enableRecording) {
      const helper = new RecordingHelper()
      recordingSession = await helper.startRecording(page, {
        name: options.recordingName || 'Example Action',
        accountType: 'gmail',
      })
    }

    try {
      // Perform actions
      await page.goto('https://example.com')
      
      // Record if recording is enabled
      if (recordingSession) {
        recordingSession.recorder.addAction({
          type: 'navigate',
          url: 'https://example.com',
          description: 'Navigate to example.com',
        })
      }

      // More actions...
      await page.click('button.submit')
      if (recordingSession) {
        recordingSession.recorder.addAction({
          type: 'click',
          selector: 'button.submit',
          description: 'Click submit',
        })
      }

    } finally {
      // Stop and save recording if enabled
      if (recordingSession) {
        const recordingId = await recordingSession.stopAndSave()
        return recordingId
      }
    }

    return null
  }
}

/**
 * Ví dụ 4: Tích hợp Recording vào CoinGeckoCandyService
 * 
 * Chỉ cần thêm recording vào method claimCandyForAccount
 */
export async function addRecordingToCoinGeckoService(
  page: Page,
  candyPage: CoinGeckoCandyPageController,
  accountId: string,
  enableRecording: boolean = false
): Promise<string | null> {
  if (!enableRecording) {
    return null
  }

  const helper = new RecordingHelper()
  const session = await helper.startRecording(page, {
    name: `CoinGecko Candy - ${accountId}`,
    accountType: 'coingecko',
    url: page.url(),
  })

  try {
    // Check login status
    const loginStatus = await candyPage.checkLoginStatus()
    session.recorder.addAction({
      type: 'evaluate',
      script: '// Check login status',
      description: `Login status: ${loginStatus}`,
    })

    // If logged out, perform login
    if (loginStatus === 'logged_out') {
      // Record login actions...
      // (sẽ cần modify CandyPageController để hỗ trợ recording)
    }

    // Claim candy
    const claimResult = await candyPage.claimDailyCandy()
    session.recorder.addAction({
      type: 'evaluate',
      script: '// Claim candy',
      description: `Claim result: ${claimResult.status}`,
    })

  } finally {
    const recordingId = await session.stopAndSave()
    return recordingId
  }
}

