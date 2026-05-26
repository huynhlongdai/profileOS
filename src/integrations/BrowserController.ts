/**
 * BrowserController - Browser automation using Playwright
 * 
 * Implements AUTOMATION_LAYER_SPEC.md interface
 * Connects to GPMLogin profile via remote debugging port
 * and performs browser automation tasks.
 */

import { GMAIL_SELECTORS, trySelectors, tryClick, hasAnySelector } from '@/plugins/gmail/GmailSelectors'
import { withRetry, safeAction, ErrorClassification } from '@/core/utils/RetryUtils'

// Lazy import Playwright to avoid issues in middleware/edge runtime
type Browser = any
type Page = any
type BrowserContext = any
let chromium: any = null

async function getPlaywright() {
  if (!chromium) {
    const playwright = await import('playwright')
    chromium = playwright.chromium
  }
  return { chromium }
}

// Spec-compliant interfaces from AUTOMATION_LAYER_SPEC.md
export interface BrowserSession {
  close(): Promise<void>
}

export interface GmailPageController {
  checkLoginStatus(): Promise<'logged_in' | 'logged_out' | 'unknown'>
  performLogin(email: string, password: string): Promise<void>
  performCareBehavior(): Promise<void>
  getPage(): Page // Expose page for module-specific care behavior
}

export interface CoinGeckoCandyPageController {
  /**
   * Đảm bảo đã ở trang Candy: https://www.coingecko.com/en/candy
   * (Nếu chưa thì tự navigate).
   */
  goToCandyPage(): Promise<void>

  /**
   * Kiểm tra đã login hay chưa.
   * 'logged_in' | 'logged_out' | 'unknown'
   */
  checkLoginStatus(): Promise<'logged_in' | 'logged_out' | 'unknown'>

  /**
   * Thực hiện login với email/password, giả định form login của CoinGecko:
   * email + password, có thể phải handle trường hợp captcha = nhờ người dùng.
   */
  performLogin(email: string, password: string): Promise<void>

  /**
   * Thực hiện login qua Google OAuth.
   * Sử dụng Google account đã login trong browser để authenticate.
   */
  performLoginWithGoogle(googleEmail: string): Promise<void>

  /**
   * Thực hiện claim daily Candy.
   * Trả về trạng thái claim và (nếu được) số Candy mới.
   */
  claimDailyCandy(): Promise<{
    status: 'claimed' | 'already_claimed' | 'error'
    candyAmount?: number
  }>

  /**
   * Optional: thử làm một số mission đơn giản (nếu muốn).
   */
  tryCompleteMissions(): Promise<void>

  /**
   * Expose page for module-specific behavior
   */
  getPage(): Page
}

export interface BrowserController {
  connectByRemoteDebugging(host: string, port: number): Promise<BrowserSession>
  openGmailTab(session: BrowserSession): Promise<GmailPageController>
  openCoinGeckoCandyPage(session: BrowserSession): Promise<CoinGeckoCandyPageController>
}

// Legacy interface for backward compatibility
export interface BrowserControllerOptions {
  host: string
  port: number
  timeout?: number
}

/**
 * Playwright-based BrowserSession implementation
 */
class PlaywrightBrowserSession implements BrowserSession {
  private browser: Browser
  private context: BrowserContext | null = null

  constructor(browser: Browser) {
    this.browser = browser
  }

  async close(): Promise<void> {
    // Note: We don't close the browser, just disconnect our connection
    // The browser is managed by GPMLogin
    try {
      if (this.context) {
        // Close all pages in context
        const pages = this.context.pages()
        for (const page of pages) {
          await page.close().catch(() => { })
        }
      }
      // Disconnect from browser (but don't close it)
      await this.browser.close().catch(() => { })
    } catch (error) {
      console.error('Error closing browser session:', error)
    }
  }

  getBrowser(): Browser {
    return this.browser
  }

  setContext(context: BrowserContext): void {
    this.context = context
  }

  getContext(): BrowserContext | null {
    return this.context
  }
}

/**
 * Playwright-based GmailPageController implementation
 */
class PlaywrightGmailPageController implements GmailPageController {
  private page: Page

  constructor(page: Page) {
    this.page = page
  }

  async checkLoginStatus(): Promise<'logged_in' | 'logged_out' | 'unknown'> {
    try {
      const currentUrl = this.page.url()

      // If we're on Gmail inbox, likely logged in
      if (currentUrl.includes('mail.google.com/mail/u/') || currentUrl.includes('mail.google.com/mail/#')) {
        // Check for inbox indicators using centralized selectors
        if (await hasAnySelector(this.page, GMAIL_SELECTORS.inbox.loggedInIndicators)) {
          return 'logged_in'
        }

        // Check for account menu (another strong indicator of being logged in)
        if (await hasAnySelector(this.page, GMAIL_SELECTORS.inbox.accountMenu)) {
          return 'logged_in'
        }

        // If we're on Gmail domain but can't find inbox, might be logged in
        if (currentUrl.includes('mail.google.com')) {
          return 'logged_in'
        }
      }

      // If we're on Google sign-in page, logged out
      if (currentUrl.includes('accounts.google.com/signin') || currentUrl.includes('accounts.google.com/ServiceLogin')) {
        return 'logged_out'
      }

      // Check for login form elements using centralized selectors
      if (await hasAnySelector(this.page, GMAIL_SELECTORS.inbox.loggedOutIndicators)) {
        return 'logged_out'
      }

      // Check for 2FA indicators
      if (await hasAnySelector(this.page, GMAIL_SELECTORS.login.twoFactorIndicators)) {
        // User is in 2FA flow, technically logged in but needs verification
        return 'logged_out'
      }

      return 'unknown'
    } catch (error) {
      console.error('Error checking login status:', error)
      return 'unknown'
    }
  }

  async performLogin(email: string, password: string): Promise<void> {
    try {
      // Navigate to Gmail login if not already there
      const currentUrl = this.page.url()
      if (!currentUrl.includes('accounts.google.com')) {
        await this.page.goto('https://accounts.google.com/signin', {
          waitUntil: 'domcontentloaded',
          timeout: 30000,
        })
      }

      // Wait for email input using centralized selectors with retry
      const emailInput = await withRetry(
        async () => {
          const input = await trySelectors(this.page, GMAIL_SELECTORS.login.emailInput, { waitFor: true, timeout: 10000 })
          if (!input) throw new Error('Email input not found')
          return input
        },
        { maxRetries: 2, initialDelayMs: 1000 }
      )

      // Fill email
      await emailInput.fill(email)
      await this.page.waitForTimeout(500 + Math.random() * 500) // Human-like delay

      // Click Next button using centralized selectors
      const nextClicked = await tryClick(this.page, GMAIL_SELECTORS.login.nextButton)
      if (!nextClicked) {
        // Fallback: try to find button by text content
        await this.page.evaluate(() => {
          const buttons = Array.from(document.querySelectorAll('button'))
          const nextBtn = buttons.find((btn) =>
            btn.textContent?.trim().toLowerCase().includes('next') ||
            btn.textContent?.trim().toLowerCase().includes('tiếp theo')
          )
          if (nextBtn) (nextBtn as HTMLButtonElement).click()
        })
      }

      await this.page.waitForTimeout(1000 + Math.random() * 1000)

      // Wait for password input using centralized selectors with retry
      const passwordInput = await withRetry(
        async () => {
          const input = await trySelectors(this.page, GMAIL_SELECTORS.login.passwordInput, { waitFor: true, timeout: 10000 })
          if (!input) throw new Error('Password input not found')
          return input
        },
        { maxRetries: 2, initialDelayMs: 1000 }
      )

      // Fill password
      await passwordInput.fill(password)
      await this.page.waitForTimeout(500 + Math.random() * 500)

      // Click Password Next button using centralized selectors
      const nextClicked2 = await tryClick(this.page, GMAIL_SELECTORS.login.passwordNextButton)
      if (!nextClicked2) {
        await this.page.evaluate(() => {
          const buttons = Array.from(document.querySelectorAll('button'))
          const nextBtn = buttons.find((btn) =>
            btn.textContent?.trim().toLowerCase().includes('next') ||
            btn.textContent?.trim().toLowerCase().includes('tiếp theo')
          )
          if (nextBtn) (nextBtn as HTMLButtonElement).click()
        })
      }

      // Wait for navigation to Gmail inbox or 2FA challenge
      await this.page.waitForLoadState('domcontentloaded', { timeout: 30000 })

      const finalUrl = this.page.url()

      // Check for 2FA using centralized selectors
      if (finalUrl.includes('challenge') || finalUrl.includes('signin/v2/challenge')) {
        // Also check for 2FA elements
        if (await hasAnySelector(this.page, GMAIL_SELECTORS.login.twoFactorIndicators)) {
          throw new Error('2FA required - manual intervention needed')
        }
      }

      // Check for login errors
      if (await hasAnySelector(this.page, GMAIL_SELECTORS.login.errorMessages)) {
        throw new Error('Login failed - check credentials')
      }

      // Verify we're logged in
      if (!finalUrl.includes('mail.google.com')) {
        // Give Gmail a chance to redirect
        await this.page.waitForTimeout(3000)
        const newUrl = this.page.url()
        if (!newUrl.includes('mail.google.com')) {
          throw new Error('Login failed - did not reach Gmail inbox')
        }
      }
    } catch (error) {
      console.error('Error performing login:', error)
      throw error
    }
  }

  async performCareBehavior(): Promise<void> {
    try {
      // Navigate to Gmail inbox if not already there
      const currentUrl = this.page.url()
      if (!currentUrl.includes('mail.google.com')) {
        await this.page.goto('https://mail.google.com', {
          waitUntil: 'domcontentloaded',
          timeout: 30000,
        })
      }

      // Wait for inbox to load
      await this.page.waitForLoadState('domcontentloaded')
      await this.page.waitForTimeout(2000 + Math.random() * 2000) // 2-4s delay

      // Scroll inbox
      await this.page.evaluate(() => {
        window.scrollBy(0, 300 + Math.random() * 400)
      })
      await this.page.waitForTimeout(2000 + Math.random() * 3000) // 2-5s delay

      // Try to open a random email
      const emailLinks = await this.page.$$('div[role="main"] a[href*="#inbox"]').catch(() => [])
      if (emailLinks.length > 0) {
        const randomIndex = Math.floor(Math.random() * Math.min(emailLinks.length, 5))
        if (emailLinks[randomIndex]) {
          await emailLinks[randomIndex].click().catch(() => { })
          await this.page.waitForTimeout(3000 + Math.random() * 4000) // 3-7s delay

          // Scroll email content
          await this.page.evaluate(() => {
            window.scrollBy(0, 200 + Math.random() * 300)
          })
          await this.page.waitForTimeout(2000 + Math.random() * 3000)

          // Go back to inbox
          await this.page.goBack().catch(() => { })
          await this.page.waitForTimeout(2000 + Math.random() * 2000)
        }
      }

      // Try to browse different labels (Sent, Drafts, etc.)
      const labelSelectors = [
        '[aria-label*="Sent"]',
        '[aria-label*="Drafts"]',
        '[aria-label*="Starred"]',
      ]

      for (const selector of labelSelectors) {
        try {
          const label = await this.page.$(selector)
          if (label) {
            await label.click()
            await this.page.waitForTimeout(2000 + Math.random() * 3000)
            break // Only visit one label per care session
          }
        } catch {
          // Continue to next label
        }
      }

      // Final scroll
      await this.page.evaluate(() => {
        window.scrollBy(0, 200 + Math.random() * 300)
      })
      await this.page.waitForTimeout(2000 + Math.random() * 2000)
    } catch (error) {
      console.error('Error performing care behavior:', error)
      // Don't throw - care behavior failures are non-critical
    }
  }

  getPage(): Page {
    return this.page
  }
}

/**
 * Playwright-based CoinGeckoCandyPageController implementation
 */
class PlaywrightCoinGeckoCandyPageController implements CoinGeckoCandyPageController {
  private page: Page

  constructor(page: Page) {
    this.page = page
  }

  async goToCandyPage(): Promise<void> {
    try {
      const currentUrl = this.page.url()
      if (!currentUrl.includes('coingecko.com/en/candy')) {
        await this.page.goto('https://www.coingecko.com/en/candy', {
          waitUntil: 'domcontentloaded',
          timeout: 30000,
        })
        await this.page.waitForLoadState('domcontentloaded')
        await this.page.waitForTimeout(2000) // Wait for page to stabilize
      }
    } catch (error) {
      console.error('Error navigating to Candy page:', error)
      throw error
    }
  }

  async checkLoginStatus(): Promise<'logged_in' | 'logged_out' | 'unknown'> {
    try {
      await this.goToCandyPage()
      await this.page.waitForLoadState('domcontentloaded')
      await this.page.waitForTimeout(2000) // Wait for page to stabilize

      // Check for login indicators (user is logged in)
      // Check for Collect Candy button - only visible when logged in
      const collectButtonSelector = 'button#collectButton[data-action="click->candy#collectCandy"]'
      try {
        const collectButton = await this.page.$(collectButtonSelector)
        if (collectButton) {
          const isVisible = await collectButton.isVisible().catch(() => false)
          if (isVisible) {
            return 'logged_in'
          }
        }
      } catch {
        // Continue to check other indicators
      }

      // Other logged in indicators
      const loggedInIndicators = [
        '[data-testid="user-menu"]',
        'button[aria-label*="Account"]',
        'a[href*="/account"]',
        '.user-menu',
        '[data-target="user-menu"]',
      ]

      for (const selector of loggedInIndicators) {
        try {
          const element = await this.page.$(selector)
          if (element) {
            const isVisible = await element.isVisible().catch(() => false)
            if (isVisible) {
              return 'logged_in'
            }
          }
        } catch {
          // Continue to next selector
        }
      }

      // Check for login button (user is logged out)
      // Use the exact selector provided by user
      const loginButtonSelector = 'button[data-action="click->auth#openSignInModal"]'
      try {
        const loginButton = await this.page.$(loginButtonSelector)
        if (loginButton) {
          const isVisible = await loginButton.isVisible().catch(() => false)
          if (isVisible) {
            return 'logged_out'
          }
        }
      } catch {
        // Continue to check other indicators
      }

      // Fallback: Check for other login button/sign in link
      const loginIndicators = [
        'a[href*="/sign_in"]',
        'button:has-text("Sign In")',
        'a:has-text("Sign In")',
        'button:has-text("Log in")',
        'a:has-text("Login")',
      ]

      for (const selector of loginIndicators) {
        try {
          const element = await this.page.$(selector)
          if (element) {
            const isVisible = await element.isVisible().catch(() => false)
            if (isVisible) {
              return 'logged_out'
            }
          }
        } catch {
          // Continue to next selector
        }
      }

      return 'unknown'
    } catch (error) {
      console.error('Error checking login status:', error)
      return 'unknown'
    }
  }

  async performLogin(email: string, password: string): Promise<void> {
    try {
      await this.goToCandyPage()
      await this.page.waitForLoadState('domcontentloaded')
      await this.page.waitForTimeout(2000)

      // Step 1: Click the "Log in" button using exact selector
      const loginButtonSelector = 'button[data-action="click->auth#openSignInModal"]'

      let loginButtonClicked = false
      try {
        const loginButton = await this.page.$(loginButtonSelector)
        if (loginButton) {
          await loginButton.scrollIntoViewIfNeeded()
          await this.page.waitForTimeout(500 + Math.random() * 500)
          await loginButton.click()
          loginButtonClicked = true
        }
      } catch (error) {
        console.warn('Error clicking login button with exact selector, trying fallback:', error)
      }

      // Fallback: Try other login button selectors
      if (!loginButtonClicked) {
        const signInSelectors = [
          'a[href*="/sign_in"]',
          'button:has-text("Sign In")',
          'a:has-text("Sign In")',
          'button:has-text("Log in")',
          'a:has-text("Login")',
        ]

        for (const selector of signInSelectors) {
          try {
            const element = await this.page.$(selector)
            if (element) {
              await element.scrollIntoViewIfNeeded()
              await this.page.waitForTimeout(500 + Math.random() * 500)
              await element.click()
              loginButtonClicked = true
              break
            }
          } catch {
            // Continue to next selector
          }
        }
      }

      if (!loginButtonClicked) {
        throw new Error('Could not find login button')
      }

      // Wait for login modal/form to appear
      await this.page.waitForTimeout(1000 + Math.random() * 1000)

      // Step 2: Wait for login form (email input)
      await this.page.waitForSelector('input[type="email"], input[name="email"], input[placeholder*="email" i]', {
        timeout: 10000,
        state: 'visible',
      })

      // Wait for modal overlay to stabilize (prevent overlay blocking clicks)
      await this.page.waitForTimeout(500)

      // Remove blocking overlays if they exist
      try {
        await this.page.evaluate(() => {
          // Find and remove or hide overlay elements that block pointer events
          const overlays = document.querySelectorAll('[aria-hidden="true"][class*="tw-fixed"][class*="tw-inset-0"]')
          overlays.forEach((overlay) => {
            const element = overlay as HTMLElement
            if (element.style.pointerEvents === 'none' || element.style.pointerEvents === '') {
              element.style.pointerEvents = 'none'
            }
          })
        })
      } catch {
        // Ignore errors
      }

      await this.page.waitForTimeout(500 + Math.random() * 500)

      // Step 3: Fill email with human-like typing
      const emailInput = await this.page.$('input[type="email"], input[name="email"], input[placeholder*="email" i]')
      if (emailInput) {
        // Try normal click first, then force if blocked
        try {
          await emailInput.click({ timeout: 5000 })
        } catch {
          // If blocked by overlay, try force click
          await emailInput.click({ force: true, timeout: 5000 })
        }
        await this.page.waitForTimeout(200 + Math.random() * 300)
        // Clear existing content
        await emailInput.fill('')
        await this.page.waitForTimeout(200 + Math.random() * 300)
        // Type email character by character for human-like behavior
        for (const char of email) {
          await emailInput.type(char, { delay: 50 + Math.random() * 100 })
        }
        await this.page.waitForTimeout(500 + Math.random() * 500)
      }

      // Step 4: Fill password with human-like typing
      const passwordInput = await this.page.$('input[type="password"], input[name="password"]')
      if (passwordInput) {
        await passwordInput.click()
        await this.page.waitForTimeout(200 + Math.random() * 300)
        // Type password character by character
        for (const char of password) {
          await passwordInput.type(char, { delay: 50 + Math.random() * 100 })
        }
        await this.page.waitForTimeout(500 + Math.random() * 500)
      }

      // Step 5: Submit form
      const submitButton = await this.page
        .$('button[type="submit"], button:has-text("Sign In"), button:has-text("Log In"), button:has-text("Continue")')
        .catch(() => null)
      if (submitButton) {
        await submitButton.scrollIntoViewIfNeeded()
        await this.page.waitForTimeout(300 + Math.random() * 400)
        await submitButton.click()
      } else {
        // Try pressing Enter
        await this.page.keyboard.press('Enter')
      }

      // Step 6: Wait for navigation or success
      await this.page.waitForLoadState('domcontentloaded', { timeout: 30000 })
      await this.page.waitForTimeout(3000)

      // Step 7: Verify login success
      const loginStatus = await this.checkLoginStatus()
      if (loginStatus !== 'logged_in') {
        // Try checking again after a longer wait
        await this.page.waitForTimeout(3000)
        const finalStatus = await this.checkLoginStatus()
        if (finalStatus !== 'logged_in') {
          throw new Error('Login failed - still not logged in after attempt')
        }
      }
    } catch (error) {
      console.error('Error performing login:', error)
      throw error
    }
  }

  async performLoginWithGoogle(googleEmail: string): Promise<void> {
    try {
      await this.goToCandyPage()
      await this.page.waitForLoadState('domcontentloaded')
      await this.page.waitForTimeout(2000)

      // Step 1: Click the "Log in" button using exact selector
      const loginButtonSelector = 'button[data-action="click->auth#openSignInModal"]'

      let loginButtonClicked = false
      try {
        const loginButton = await this.page.$(loginButtonSelector)
        if (loginButton) {
          await loginButton.scrollIntoViewIfNeeded()
          await this.page.waitForTimeout(500 + Math.random() * 500)
          await loginButton.click()
          loginButtonClicked = true
        }
      } catch (error) {
        console.warn('Error clicking login button with exact selector, trying fallback:', error)
      }

      // Fallback: Try other login button selectors
      if (!loginButtonClicked) {
        const signInSelectors = [
          'a[href*="/sign_in"]',
          'button:has-text("Sign In")',
          'a:has-text("Sign In")',
          'button:has-text("Log in")',
        ]

        for (const selector of signInSelectors) {
          try {
            const element = await this.page.$(selector)
            if (element) {
              await element.scrollIntoViewIfNeeded()
              await this.page.waitForTimeout(500 + Math.random() * 500)
              await element.click()
              loginButtonClicked = true
              break
            }
          } catch {
            // Continue to next selector
          }
        }
      }

      if (!loginButtonClicked) {
        throw new Error('Could not find login button')
      }

      // Wait for login modal to appear and overlay to stabilize
      await this.page.waitForTimeout(1500 + Math.random() * 1000)

      // Wait for modal overlay to be fully loaded and not blocking
      try {
        await this.page.waitForSelector('#auth-modal', { state: 'visible', timeout: 5000 })
        // Additional wait for animations/transitions to complete
        await this.page.waitForTimeout(500)

        // Remove blocking overlays if they exist
        await this.page.evaluate(() => {
          const overlays = document.querySelectorAll('[aria-hidden="true"][class*="tw-fixed"][class*="tw-inset-0"]')
          overlays.forEach((overlay) => {
            const element = overlay as HTMLElement
            element.style.pointerEvents = 'none'
          })
        })
      } catch {
        // Modal might not appear, continue anyway
      }

      // Step 2: Wait for modal to be fully visible and click "Continue with Google"
      // Try XPath first (most specific)
      const googleButtonXPath = '//*[@id="auth-modal"]/div[3]/div/div[1]/div[4]/div/button[1]'
      const googleButtonSelector = 'button[data-action*="click->auth#trackSignInMethodCta"][data-sso-type="google"]'

      let googleButtonClicked = false

      // Strategy 1: Try XPath selector (provided by user - most accurate)
      try {
        // Wait for modal to appear first
        await this.page.waitForSelector('#auth-modal', { timeout: 8000, state: 'visible' })
        await this.page.waitForTimeout(500 + Math.random() * 500)

        // Try to find button using XPath
        // Playwright supports XPath directly via locator() or using xpath= prefix
        try {
          const googleButtonByXPath = this.page.locator(googleButtonXPath)
          await googleButtonByXPath.waitFor({ state: 'visible', timeout: 5000 })

          const isVisible = await googleButtonByXPath.isVisible().catch(() => false)
          if (isVisible) {
            await googleButtonByXPath.scrollIntoViewIfNeeded()
            await this.page.waitForTimeout(300 + Math.random() * 400)
            await googleButtonByXPath.click()
            googleButtonClicked = true
            console.log('[CoinGecko] Clicked "Continue with Google" button using XPath:', googleButtonXPath)
          }
        } catch (xpathError) {
          // Try alternative XPath syntax
          try {
            const googleButtonByXPathAlt = await this.page.$(`xpath=${googleButtonXPath}`).catch(() => null)
            if (googleButtonByXPathAlt) {
              const isVisible = await googleButtonByXPathAlt.isVisible().catch(() => false)
              if (isVisible) {
                await googleButtonByXPathAlt.scrollIntoViewIfNeeded()
                await this.page.waitForTimeout(300 + Math.random() * 400)
                await googleButtonByXPathAlt.click()
                googleButtonClicked = true
                console.log('[CoinGecko] Clicked "Continue with Google" button using XPath (alt method)')
              }
            }
          } catch {
            // Continue to next strategy
          }
        }
      } catch (error) {
        console.warn('[CoinGecko] Error clicking Continue with Google using XPath, trying other selectors:', error)
      }

      // Strategy 2: Try exact attribute selector
      if (!googleButtonClicked) {
        try {
          await this.page.waitForSelector(googleButtonSelector, { timeout: 5000, state: 'visible' })
          await this.page.waitForTimeout(500 + Math.random() * 500)

          const googleButton = await this.page.$(googleButtonSelector)
          if (googleButton) {
            const isVisible = await googleButton.isVisible().catch(() => false)
            if (isVisible) {
              await googleButton.scrollIntoViewIfNeeded()
              await this.page.waitForTimeout(300 + Math.random() * 400)
              await googleButton.click()
              googleButtonClicked = true
              console.log('[CoinGecko] Clicked "Continue with Google" button using attribute selector')
            }
          }
        } catch (error) {
          console.warn('[CoinGecko] Error clicking Continue with Google with attribute selector, trying fallback:', error)
        }
      }

      // Strategy 3: Try other Google login button selectors (fallback)
      if (!googleButtonClicked) {
        const googleLoginSelectors = [
          'button:has-text("Continue with Google")',
          'button:has-text("Sign in with Google")',
          'button[data-url*="/omniauth/google_oauth2"]',
          'a:has-text("Continue with Google")',
          '[data-testid="google-login"]',
          // Try finding by Google logo
          'button:has(svg):has-text("Google")',
          'button:has(img[alt*="Google"])',
          // Try alternative XPath patterns
          '//button[contains(@data-sso-type, "google")]',
          '//button[contains(text(), "Continue with Google")]',
        ]

        for (const selector of googleLoginSelectors) {
          try {
            let element
            if (selector.startsWith('//')) {
              // XPath selector
              element = await this.page.$(`xpath=${selector}`).catch(() => null)
            } else {
              // CSS selector
              element = await this.page.$(selector)
            }

            if (element) {
              const isVisible = await element.isVisible().catch(() => false)
              if (isVisible) {
                await element.scrollIntoViewIfNeeded()
                await this.page.waitForTimeout(300 + Math.random() * 400)
                await element.click()
                googleButtonClicked = true
                console.log(`[CoinGecko] Clicked "Continue with Google" using fallback selector: ${selector}`)
                break
              }
            }
          } catch {
            // Continue to next selector
          }
        }
      }

      // Strategy 4: Image Search (fallback when all selectors fail)
      // Inspired by GPM Automation's Image Search feature (https://docs.gpmautomate.com/image-search)
      // To use: Save a screenshot of the "Continue with Google" button to resources/images/continue-google-button.png
      if (!googleButtonClicked) {
        try {
          console.log('[CoinGecko] Trying Image Search strategy for "Continue with Google" button...')
          const { ImageSearchHelper } = await import('@/core/utils/ImageSearchHelper')
          const path = await import('path')

          // Path to template image (relative to project root)
          const templateImagePath = path.join(
            process.cwd(),
            'resources',
            'images',
            'continue-google-button.png'
          )

          // Check if template image exists
          const fs = await import('fs/promises')
          try {
            await fs.access(templateImagePath)
            console.log('[CoinGecko] Template image found, starting image search...', templateImagePath)

            // Try to find button using image search
            // First, try searching within modal region for better performance
            const modalElement = await this.page.$('#auth-modal')
            if (modalElement) {
              const modalBox = await modalElement.boundingBox()
              if (modalBox) {
                console.log('[CoinGecko] Searching for button within modal region...', {
                  x: modalBox.x,
                  y: modalBox.y,
                  width: modalBox.width,
                  height: modalBox.height,
                })

                const imageResult = await ImageSearchHelper.findImage(this.page, templateImagePath, {
                  threshold: 0.7, // 70% similarity required
                  region: {
                    x: Math.max(0, Math.floor(modalBox.x)),
                    y: Math.max(0, Math.floor(modalBox.y)),
                    width: Math.floor(modalBox.width),
                    height: Math.floor(modalBox.height),
                  },
                })

                if (imageResult.found && imageResult.x !== undefined && imageResult.y !== undefined) {
                  console.log(`[CoinGecko] ✅ Found "Continue with Google" button using Image Search!`, {
                    confidence: imageResult.confidence?.toFixed(2),
                    x: imageResult.x,
                    y: imageResult.y,
                    region: imageResult.region,
                  })

                  // Scroll to the found position and click
                  await this.page.mouse.move(imageResult.x, imageResult.y)
                  await this.page.waitForTimeout(200 + Math.random() * 300)
                  await this.page.mouse.click(imageResult.x, imageResult.y)
                  googleButtonClicked = true
                  console.log('[CoinGecko] ✅ Clicked "Continue with Google" button using Image Search')
                } else {
                  console.log('[CoinGecko] Image search in modal region did not find button')
                }
              }
            }

            // If modal bounding box not available or search failed, search full viewport
            if (!googleButtonClicked) {
              console.log('[CoinGecko] Searching for button in full viewport...')
              const imageResult = await ImageSearchHelper.findImage(this.page, templateImagePath, {
                threshold: 0.7,
              })

              if (imageResult.found && imageResult.x !== undefined && imageResult.y !== undefined) {
                console.log(`[CoinGecko] ✅ Found "Continue with Google" button using Image Search (full page)!`, {
                  confidence: imageResult.confidence?.toFixed(2),
                  x: imageResult.x,
                  y: imageResult.y,
                })

                await this.page.mouse.move(imageResult.x, imageResult.y)
                await this.page.waitForTimeout(200 + Math.random() * 300)
                await this.page.mouse.click(imageResult.x, imageResult.y)
                googleButtonClicked = true
                console.log('[CoinGecko] ✅ Clicked "Continue with Google" button using Image Search (full page)')
              } else {
                console.log('[CoinGecko] Image search did not find button (confidence too low or not found)')
              }
            }
          } catch (accessError) {
            // Template image not found, skip image search
            console.log('[CoinGecko] Template image not found, skipping image search strategy:', templateImagePath)
            console.log('[CoinGecko] To use image search, save screenshot to:', templateImagePath)
          }
        } catch (error) {
          console.warn('[CoinGecko] Image search failed:', error)
        }
      }

      if (!googleButtonClicked) {
        throw new Error('Could not find "Continue with Google" button in modal')
      }

      // Step 3: Wait for Google OAuth page to load
      console.log('[CoinGecko] Waiting for Google OAuth page to load...')
      await this.page.waitForTimeout(3000)

      // Wait for navigation to Google accounts page
      try {
        await this.page.waitForURL(
          (url: URL) => url.href.includes('accounts.google.com'),
          { timeout: 20000 }
        )
        console.log('[CoinGecko] Navigated to Google accounts page:', this.page.url())
      } catch (error) {
        console.warn('[CoinGecko] Did not navigate to Google accounts page, current URL:', this.page.url())
        // Continue - might be in popup or already redirected
      }

      await this.page.waitForLoadState('domcontentloaded', { timeout: 30000 })
      await this.page.waitForTimeout(2000)

      // Step 4: Handle Google account selection if needed
      const currentUrl = this.page.url()
      console.log('[CoinGecko] Current URL after OAuth click:', currentUrl)

      if (currentUrl.includes('accounts.google.com')) {
        // We're on Google account selection or consent page

        // Wait a bit for page to stabilize
        await this.page.waitForTimeout(2000)

        // Check if we're on account selection page (multiple accounts shown)
        // Google uses various URL patterns for account selection
        let isAccountChooserPage = currentUrl.includes('AccountChooser') ||
          currentUrl.includes('accountchooser') ||
          currentUrl.includes('accountschooser') ||
          currentUrl.includes('o/oauth2')

        // Also check if page has account selection elements
        if (!isAccountChooserPage) {
          try {
            const hasAccountElements = await Promise.race([
              this.page.waitForSelector('div[data-email]', { timeout: 2000 }).then(() => true),
              this.page.waitForSelector('div:has-text("@gmail.com")', { timeout: 2000 }).then(() => true),
              this.page.waitForSelector('div:has-text("@googlemail.com")', { timeout: 2000 }).then(() => true),
              this.page.waitForSelector('ul[role="list"]', { timeout: 2000 }).then(() => true),
            ]).catch(() => false)
            isAccountChooserPage = hasAccountElements === true
          } catch {
            // Continue
          }
        }

        if (isAccountChooserPage) {
          console.log('[CoinGecko] On account selection page, looking for email:', googleEmail)

          // Try multiple strategies to find and click the account
          let accountSelected = false

          // Strategy 1: Look for exact email match in various elements
          const emailMatchSelectors = [
            `[data-email="${googleEmail}"]`,
            `[data-identifier="${googleEmail}"]`,
            `div:has-text("${googleEmail}")`,
            `li:has-text("${googleEmail}")`,
            `button:has-text("${googleEmail}")`,
            `a:has-text("${googleEmail}")`,
            `div[role="button"]:has-text("${googleEmail}")`,
            `div[role="listitem"]:has-text("${googleEmail}")`,
          ]

          for (const selector of emailMatchSelectors) {
            try {
              await this.page.waitForSelector(selector, { timeout: 3000, state: 'visible' })
              const accountElement = await this.page.$(selector)
              if (accountElement) {
                const isVisible = await accountElement.isVisible().catch(() => false)
                if (isVisible) {
                  console.log(`[CoinGecko] Found account element with selector: ${selector}`)
                  await accountElement.scrollIntoViewIfNeeded()
                  await this.page.waitForTimeout(500 + Math.random() * 500)
                  await accountElement.click()
                  await this.page.waitForTimeout(2000)
                  await this.page.waitForLoadState('domcontentloaded', { timeout: 30000 })
                  accountSelected = true
                  console.log('[CoinGecko] Successfully clicked account:', googleEmail)
                  break
                }
              }
            } catch {
              // Continue to next selector
            }
          }

          // Strategy 2: If exact match not found, try finding by partial email match
          if (!accountSelected) {
            const emailDomain = googleEmail.split('@')[1] // e.g., "gmail.com"
            const emailUsername = googleEmail.split('@')[0] // e.g., "user"

            try {
              // Look for elements containing the email domain
              const allElements = await this.page.$$('div, li, button, a')

              for (const element of allElements) {
                try {
                  const text = await element.textContent()
                  if (text && text.includes(googleEmail)) {
                    const isVisible = await element.isVisible().catch(() => false)
                    if (isVisible) {
                      console.log('[CoinGecko] Found account by text content match')
                      await element.scrollIntoViewIfNeeded()
                      await this.page.waitForTimeout(500 + Math.random() * 500)
                      await element.click()
                      await this.page.waitForTimeout(2000)
                      await this.page.waitForLoadState('domcontentloaded', { timeout: 30000 })
                      accountSelected = true
                      console.log('[CoinGecko] Successfully clicked account by text match:', googleEmail)
                      break
                    }
                  }
                } catch {
                  // Continue to next element
                }
              }
            } catch (error) {
              console.warn('[CoinGecko] Error in text-based account search:', error)
            }
          }

          // Strategy 3: If still not found, click first available Google account
          if (!accountSelected) {
            console.log('[CoinGecko] Exact email not found, trying to click first available account')
            try {
              const firstAccountSelectors = [
                'div[role="button"]:has-text("@")',
                'li[role="button"]:has-text("@")',
                'button:has-text("@")',
                'div[data-email]',
                'li[data-email]',
                // Generic account chooser buttons
                'div[jsname]', // Google uses jsname attributes
              ]

              for (const selector of firstAccountSelectors) {
                try {
                  const firstAccount = await this.page.$(selector)
                  if (firstAccount) {
                    const isVisible = await firstAccount.isVisible().catch(() => false)
                    if (isVisible) {
                      console.log('[CoinGecko] Clicking first available account with selector:', selector)
                      await firstAccount.scrollIntoViewIfNeeded()
                      await this.page.waitForTimeout(500 + Math.random() * 500)
                      await firstAccount.click()
                      await this.page.waitForTimeout(2000)
                      await this.page.waitForLoadState('domcontentloaded', { timeout: 30000 })
                      accountSelected = true
                      break
                    }
                  }
                } catch {
                  // Continue to next selector
                }
              }
            } catch (error) {
              console.warn('[CoinGecko] Error clicking first available account:', error)
            }
          }

          if (!accountSelected) {
            console.warn('[CoinGecko] Could not select any Google account')
          }
        }

        // Step 5: Handle consent page - click "Allow" or "Cho phép"
        await this.page.waitForTimeout(3000) // Wait for consent page to load

        const currentUrlAfterSelection = this.page.url()
        console.log('[CoinGecko] URL after account selection:', currentUrlAfterSelection)

        // Check if we're on consent page
        const isConsentPage = currentUrlAfterSelection.includes('oauth/consent') ||
          currentUrlAfterSelection.includes('oauthapproval') ||
          await this.page.$('button:has-text("Allow"), button:has-text("Cho phép")').then(() => true).catch(() => false)

        if (isConsentPage) {
          console.log('[CoinGecko] On consent page, looking for Allow button')

          const consentButtonSelectors = [
            'button:has-text("Allow")',
            'button:has-text("Cho phép")',
            'button[id*="approve"]',
            'button[type="submit"]:has-text("Allow")',
            'button[jsname]:has-text("Allow")',
            'button[jsname]:has-text("Cho phép")',
            // Vietnamese
            'button:has-text("Cho phép")',
            'button:has-text("Đồng ý")',
          ]

          let consentClicked = false
          for (const selector of consentButtonSelectors) {
            try {
              const consentButton = await this.page.$(selector)
              if (consentButton) {
                const isVisible = await consentButton.isVisible().catch(() => false)
                if (isVisible) {
                  console.log('[CoinGecko] Found consent button with selector:', selector)
                  await consentButton.scrollIntoViewIfNeeded()
                  await this.page.waitForTimeout(500 + Math.random() * 500)
                  await consentButton.click()
                  await this.page.waitForTimeout(3000)
                  await this.page.waitForLoadState('domcontentloaded', { timeout: 30000 })
                  consentClicked = true
                  console.log('[CoinGecko] Successfully clicked consent button')
                  break
                }
              }
            } catch {
              // Continue
            }
          }

          if (!consentClicked) {
            console.warn('[CoinGecko] Could not find consent button, but continuing...')
          }
        }
      }

      // Step 5: Wait for redirect back to CoinGecko
      try {
        await this.page.waitForURL(
          (url: URL) => url.href.includes('coingecko.com'),
          { timeout: 30000 }
        )
      } catch {
        // Continue - might already be on CoinGecko
      }

      await this.page.waitForLoadState('domcontentloaded', { timeout: 30000 })
      await this.page.waitForTimeout(3000)

      // Step 6: Verify login success
      const loginStatus = await this.checkLoginStatus()
      if (loginStatus !== 'logged_in') {
        // Try checking again after a longer wait
        await this.page.waitForTimeout(3000)
        const finalStatus = await this.checkLoginStatus()
        if (finalStatus !== 'logged_in') {
          throw new Error('Google OAuth login failed - still not logged in after attempt')
        }
      }
    } catch (error) {
      console.error('Error performing Google OAuth login:', error)
      throw error
    }
  }

  async claimDailyCandy(): Promise<{
    status: 'claimed' | 'already_claimed' | 'error'
    candyAmount?: number
  }> {
    try {
      await this.goToCandyPage()
      await this.page.waitForLoadState('domcontentloaded')
      await this.page.waitForTimeout(2000)

      // Step 1: Look for Collect Candy button using exact selector
      const collectButtonSelector = 'button#collectButton[data-action="click->candy#collectCandy"]'

      let collectButton = null
      try {
        collectButton = await this.page.$(collectButtonSelector)
        if (collectButton) {
          const isVisible = await collectButton.isVisible().catch(() => false)
          if (!isVisible) {
            collectButton = null
          }
        }
      } catch {
        // Continue to fallback selectors
      }

      // Fallback: Try other claim button selectors
      if (!collectButton) {
        const claimButtonSelectors = [
          'button:has-text("Collect Candy")',
          'button:has-text("Claim")',
          'button:has-text("Claim Daily Candy")',
          'button:has-text("Claim Candy")',
          '[data-testid="claim-button"]',
          'button.claim-button',
        ]

        for (const selector of claimButtonSelectors) {
          try {
            const button = await this.page.$(selector)
            if (button) {
              const isVisible = await button.isVisible().catch(() => false)
              if (isVisible) {
                collectButton = button
                break
              }
            }
          } catch {
            // Continue to next selector
          }
        }
      }

      if (!collectButton) {
        // Check if already claimed message exists
        const alreadyClaimedSelectors = [
          ':has-text("already claimed")',
          ':has-text("Already claimed")',
          ':has-text("You\'ve already claimed")',
          ':has-text("Claimed today")',
          ':has-text("Signed in successfully")', // Sometimes shows after already claimed
        ]

        for (const selector of alreadyClaimedSelectors) {
          try {
            const element = await this.page.$(selector)
            if (element) {
              const isVisible = await element.isVisible().catch(() => false)
              if (isVisible) {
                return { status: 'already_claimed' }
              }
            }
          } catch {
            // Continue
          }
        }

        return { status: 'error' }
      }

      // Step 2: Check if button is disabled (already claimed)
      const isDisabled = await collectButton.isDisabled().catch(() => false)
      if (isDisabled) {
        return { status: 'already_claimed' }
      }

      // Check if button text indicates already claimed
      try {
        const buttonText = await collectButton.textContent()
        if (buttonText && (buttonText.includes('Claimed') || buttonText.includes('Already'))) {
          return { status: 'already_claimed' }
        }
      } catch {
        // Continue
      }

      // Step 3: Scroll button into view and click
      await collectButton.scrollIntoViewIfNeeded()
      await this.page.waitForTimeout(500 + Math.random() * 500)
      await collectButton.click()

      // Wait for claim to process
      await this.page.waitForTimeout(2000 + Math.random() * 2000)

      // Step 4: Wait for page to update (success message, candy balance update, etc.)
      await this.page.waitForLoadState('domcontentloaded', { timeout: 10000 })
      await this.page.waitForTimeout(2000)

      // Step 5: Check for success indicators
      const successIndicators = [
        ':has-text("claimed successfully")',
        ':has-text("Claimed!")',
        ':has-text("Success")',
        ':has-text("Signed in successfully")',
      ]

      let successFound = false
      for (const selector of successIndicators) {
        try {
          const element = await this.page.$(selector)
          if (element) {
            const isVisible = await element.isVisible().catch(() => false)
            if (isVisible) {
              successFound = true
              break
            }
          }
        } catch {
          // Continue
        }
      }

      // Step 6: Try to extract candy amount from page
      let candyAmount: number | undefined
      try {
        // Look for candy balance display
        const candyBalanceSelectors = [
          ':has-text("Candy Balance")',
          '[data-testid="candy-balance"]',
          '.candy-balance',
        ]

        for (const selector of candyBalanceSelectors) {
          try {
            const balanceElement = await this.page.$(selector)
            if (balanceElement) {
              const balanceText = await balanceElement.textContent()
              if (balanceText) {
                // Extract number from text like "5925 Candy Balance" or "0 Candy Balance"
                const match = balanceText.match(/(\d+)/)
                if (match) {
                  candyAmount = parseInt(match[1], 10)
                  break
                }
              }
            }
          } catch {
            // Continue
          }
        }

        // Alternative: Look for number near "Candy" text
        if (candyAmount === undefined) {
          const allText = await this.page.textContent('body').catch(() => '')
          const candyMatch = allText.match(/(\d+)\s*Candy\s*Balance/i)
          if (candyMatch) {
            candyAmount = parseInt(candyMatch[1], 10)
          }
        }
      } catch {
        // Could not extract amount, that's okay
      }

      // Step 7: Check if button is now disabled (indicating successful claim)
      try {
        const buttonAfterClick = await this.page.$(collectButtonSelector)
        if (buttonAfterClick) {
          const isDisabledAfter = await buttonAfterClick.isDisabled().catch(() => false)
          if (isDisabledAfter) {
            return { status: 'claimed', candyAmount }
          }
        }
      } catch {
        // Continue
      }

      // If we clicked and no error indicators found, assume success
      if (successFound || candyAmount !== undefined) {
        return { status: 'claimed', candyAmount }
      }

      // If button still exists and is clickable, check again after a delay
      await this.page.waitForTimeout(2000)
      const finalCheck = await this.page.$(collectButtonSelector)
      if (finalCheck) {
        const isDisabledFinal = await finalCheck.isDisabled().catch(() => false)
        if (isDisabledFinal) {
          return { status: 'claimed', candyAmount }
        }
      }

      // Default to claimed if we clicked successfully
      return { status: 'claimed', candyAmount }
    } catch (error) {
      console.error('Error claiming daily candy:', error)
      return { status: 'error' }
    }
  }

  async tryCompleteMissions(): Promise<void> {
    try {
      await this.goToCandyPage()
      await this.page.waitForLoadState('domcontentloaded')
      await this.page.waitForTimeout(2000)

      // Look for missions section
      // This is optional and may not exist on all pages
      const missionSelectors = [
        '[data-testid="mission"]',
        '.mission',
        'button:has-text("Complete")',
        'a:has-text("Complete Mission")',
      ]

      for (const selector of missionSelectors) {
        try {
          const missionButtons = await this.page.$$(selector)
          for (const button of missionButtons.slice(0, 3)) {
            // Try to complete first 3 missions
            try {
              await button.click()
              await this.page.waitForTimeout(1000 + Math.random() * 1000)
            } catch {
              // Mission might already be completed or not clickable
            }
          }
        } catch {
          // No missions found, that's okay
        }
      }
    } catch (error) {
      console.error('Error trying to complete missions:', error)
      // Don't throw - missions are optional
    }
  }

  getPage(): Page {
    return this.page
  }
}

/**
 * Playwright-based BrowserController implementation
 */
export class PlaywrightBrowserController implements BrowserController {
  async connectByRemoteDebugging(host: string, port: number): Promise<BrowserSession> {
    const { chromium: playwrightChromium } = await getPlaywright()
    const endpoint = `http://${host}:${port}`

    // Retry logic: sometimes the remote debugging port needs a moment to be ready
    const maxRetries = 5
    const retryDelay = 1000 // 1 second

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // GPMLogin remote debugging uses WebSocket protocol (CDP)
        // Playwright's connectOverCDP expects a WebSocket URL
        // Format: ws://host:port or http://host:port (Playwright handles conversion)
        const browser = await playwrightChromium.connectOverCDP(endpoint, {
          timeout: 10000, // Reduced timeout per attempt
        })

        // Get or create context
        const contexts = browser.contexts()
        let context = contexts.length > 0 ? contexts[0] : await browser.newContext()

        const session = new PlaywrightBrowserSession(browser)
        session.setContext(context)

        console.log(`✅ Connected to browser at ${endpoint} (attempt ${attempt}/${maxRetries})`)
        return session
      } catch (error) {
        if (attempt === maxRetries) {
          console.error(`Error connecting to browser after ${maxRetries} attempts:`, error)
          throw new Error(
            `Failed to connect to browser at ${host}:${port} after ${maxRetries} attempts: ${error instanceof Error ? error.message : 'Unknown error'
            }`
          )
        }

        // Wait before retrying
        console.log(
          `⚠️ Connection attempt ${attempt}/${maxRetries} failed, retrying in ${retryDelay}ms...`
        )
        await new Promise((resolve) => setTimeout(resolve, retryDelay))
      }
    }

    // This should never be reached, but TypeScript needs it
    throw new Error(`Failed to connect to browser at ${host}:${port}`)
  }

  async openGmailTab(session: BrowserSession): Promise<GmailPageController> {
    try {
      const playwrightSession = session as PlaywrightBrowserSession
      const browser = playwrightSession.getBrowser()
      const context = playwrightSession.getContext()

      if (!context) {
        throw new Error('Browser context not available')
      }

      // Get existing pages or create new one
      const pages = context.pages()
      let page = pages.length > 0 ? pages[0] : await context.newPage()

      // Navigate to Gmail
      await page.goto('https://mail.google.com', {
        waitUntil: 'domcontentloaded',
        timeout: 30000,
      })

      return new PlaywrightGmailPageController(page)
    } catch (error) {
      console.error('Error opening Gmail tab:', error)
      throw error
    }
  }

  async openCoinGeckoCandyPage(session: BrowserSession): Promise<CoinGeckoCandyPageController> {
    try {
      const playwrightSession = session as PlaywrightBrowserSession
      const browser = playwrightSession.getBrowser()
      const context = playwrightSession.getContext()

      if (!context) {
        throw new Error('Browser context not available')
      }

      // Get existing pages or create new one
      const pages = context.pages()
      let page = pages.length > 0 ? pages[0] : await context.newPage()

      // Navigate to CoinGecko Candy page
      await page.goto('https://www.coingecko.com/en/candy', {
        waitUntil: 'domcontentloaded',
        timeout: 30000,
      })

      return new PlaywrightCoinGeckoCandyPageController(page)
    } catch (error) {
      console.error('Error opening CoinGecko Candy page:', error)
      throw error
    }
  }
}

// Legacy BrowserController class for backward compatibility
export class LegacyBrowserController {
  private options: BrowserControllerOptions
  private browser: Browser | null = null
  private context: BrowserContext | null = null
  private page: Page | null = null
  private connected: boolean = false

  constructor(options: BrowserControllerOptions) {
    this.options = options
  }

  /**
   * Connect to browser via remote debugging (CDP)
   * Legacy method - use PlaywrightBrowserController for new code
   */
  async connect(): Promise<void> {
    if (this.connected) {
      return
    }

    try {
      const { chromium: playwrightChromium } = await getPlaywright()
      const endpoint = `http://${this.options.host}:${this.options.port}`

      this.browser = await playwrightChromium.connectOverCDP(endpoint, {
        timeout: this.options.timeout || 30000,
      })

      const contexts = this.browser.contexts()
      if (contexts.length > 0) {
        this.context = contexts[0]
      } else {
        this.context = await this.browser.newContext()
      }

      const pages = this.context.pages()
      if (pages.length > 0) {
        this.page = pages[0]
      } else {
        this.page = await this.context.newPage()
      }

      this.connected = true
      console.log(`✅ Connected to browser at ${endpoint}`)
    } catch (error) {
      console.error('Error connecting to browser:', error)
      throw new Error(
        `Failed to connect to browser at ${this.options.host}:${this.options.port}: ${error instanceof Error ? error.message : 'Unknown error'
        }`
      )
    }
  }

  async disconnect(): Promise<void> {
    try {
      this.page = null
      this.context = null
      this.browser = null
      this.connected = false
    } catch (error) {
      console.error('Error disconnecting from browser:', error)
    }
  }

  private ensureConnected(): void {
    if (!this.connected || !this.page) {
      throw new Error('Browser not connected. Call connect() first.')
    }
  }

  async navigate(url: string, options?: { waitUntil?: 'load' | 'domcontentloaded' | 'networkidle' }): Promise<void> {
    this.ensureConnected()
    await this.page!.goto(url, {
      waitUntil: options?.waitUntil || 'domcontentloaded',
      timeout: this.options.timeout || 30000,
    })
  }

  async getCurrentUrl(): Promise<string> {
    this.ensureConnected()
    return this.page!.url()
  }

  async click(selector: string, options?: { timeout?: number; waitForSelector?: boolean }): Promise<void> {
    this.ensureConnected()
    if (options?.waitForSelector !== false) {
      try {
        await this.page!.waitForSelector(selector, { timeout: options?.timeout || 10000 })
      } catch {
        return
      }
    }
    await this.page!.click(selector, { timeout: options?.timeout || 10000 })
  }

  async type(selector: string, text: string, options?: { timeout?: number; delay?: number }): Promise<void> {
    this.ensureConnected()
    await this.page!.waitForSelector(selector, { timeout: options?.timeout || 10000 })
    await this.page!.fill(selector, text, { timeout: options?.timeout || 10000 })
    if (options?.delay) {
      await this.page!.waitForTimeout(options.delay)
    }
  }

  async waitForSelector(selector: string, options?: { timeout?: number; state?: 'attached' | 'detached' | 'visible' | 'hidden' }): Promise<void> {
    this.ensureConnected()
    await this.page!.waitForSelector(selector, {
      timeout: options?.timeout || 10000,
      state: options?.state || 'visible',
    })
  }

  async elementExists(selector: string, timeout?: number): Promise<boolean> {
    this.ensureConnected()
    try {
      await this.page!.waitForSelector(selector, { timeout: timeout || 5000, state: 'attached' })
      return true
    } catch {
      return false
    }
  }

  async getText(selector: string): Promise<string> {
    this.ensureConnected()
    await this.page!.waitForSelector(selector, { timeout: 10000 })
    const element = await this.page!.$(selector)
    if (!element) {
      return ''
    }
    return (await element.textContent()) || ''
  }

  async evaluate<T>(script: string | ((...args: any[]) => T), ...args: any[]): Promise<T> {
    this.ensureConnected()
    return this.page!.evaluate(script as any, ...args)
  }

  async screenshot(path?: string): Promise<Buffer> {
    this.ensureConnected()
    return await this.page!.screenshot({ path, fullPage: true })
  }

  async waitForNavigation(options?: { timeout?: number; waitUntil?: 'load' | 'domcontentloaded' | 'networkidle' }): Promise<void> {
    this.ensureConnected()
    await this.page!.waitForLoadState(options?.waitUntil || 'domcontentloaded', {
      timeout: options?.timeout || 30000,
    })
  }

  async getCookies(): Promise<any[]> {
    this.ensureConnected()
    return await this.context!.cookies()
  }

  async setCookies(cookies: any[]): Promise<void> {
    this.ensureConnected()
    await this.context!.addCookies(cookies)
  }

  async scroll(options?: { x?: number; y?: number; behavior?: 'auto' | 'smooth' }): Promise<void> {
    this.ensureConnected()
    await this.page!.evaluate((opts: any) => {
      window.scrollTo({
        left: opts.x || 0,
        top: opts.y || 0,
        behavior: opts.behavior || 'smooth',
      })
    }, options || {})
  }

  async hover(selector: string): Promise<void> {
    this.ensureConnected()
    await this.page!.waitForSelector(selector, { timeout: 10000 })
    await this.page!.hover(selector)
  }

  async selectOption(selector: string, value: string | string[]): Promise<void> {
    this.ensureConnected()
    await this.page!.waitForSelector(selector, { timeout: 10000 })
    await this.page!.selectOption(selector, value)
  }

  async pageContainsText(text: string): Promise<boolean> {
    this.ensureConnected()
    const content = await this.page!.textContent('body')
    return content?.includes(text) || false
  }
}
