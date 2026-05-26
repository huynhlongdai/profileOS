/**
 * GmailCareBehavior - Gmail-specific care behavior implementation
 * 
 * This module handles all Gmail care logic, separated from core BrowserController.
 * Based on toolold/gmail_care.py for human-like behavior simulation.
 * 
 * Improvements:
 * - More human-like delays between actions
 * - Human-like typing simulation
 * - Smart error handling and classification
 */

type Page = any // Playwright Page type

export interface GmailCareBehaviorOptions {
  email: string
  randomBehaviorLevel?: 'low' | 'medium' | 'high'
}

/**
 * Error classification for smart error handling
 */
enum ErrorType {
  SKIP_AND_CONTINUE = 'skip',      // Non-critical, skip and continue
  RETRY_ONCE = 'retry',            // Retry once then skip
  FATAL = 'fatal',                 // Critical error, should stop
}

/**
 * GmailCareBehavior - Implements detailed Gmail care actions
 */
export class GmailCareBehavior {
  private page: Page
  private email: string
  private randomBehaviorLevel: 'low' | 'medium' | 'high'

  constructor(page: Page, options: GmailCareBehaviorOptions) {
    this.page = page
    this.email = options.email
    this.randomBehaviorLevel = options.randomBehaviorLevel || 'medium'
  }

  /**
   * Main care method - performs all care actions
   * Improved with delays between steps and better error handling
   */
  async performCare(): Promise<string[]> {
    const careActions: string[] = []

    try {
      // Ensure we're on Gmail inbox
      await this.ensureGmailInbox()
      await this.randomDelay(2000, 3000) // Wait after navigation

      // 1. Check and read unread emails
      const step1Result = await this.safeAction(async () => {
        const unreadCount = await this.checkUnreadEmails()
        if (unreadCount > 0) {
          const readCount = await this.readEmails(Math.min(5, unreadCount))
          if (readCount > 0) {
            return `Đã đọc ${readCount} email`
          }
        }
        return null
      }, 'checking/reading emails', null)

      if (step1Result) {
        careActions.push(step1Result)
      }
      await this.randomDelay(2000, 4000) // Human-like pause between steps

      // 2. Interact with emails (star, archive, delete)
      const step2Result = await this.safeAction(async () => {
        const interacted = await this.interactWithEmails()
        return interacted ? 'Đã tương tác với email' : null
      }, 'interacting with emails', null)

      if (step2Result) {
        careActions.push(step2Result)
      }
      await this.randomDelay(2000, 4000) // Human-like pause between steps

      // 3. Search emails
      const step3Result = await this.safeAction(async () => {
        const searchSuccess = await this.searchEmails()
        return searchSuccess ? 'Đã thực hiện tìm kiếm' : null
      }, 'searching emails', null)

      if (step3Result) {
        careActions.push(step3Result)
      }
      await this.randomDelay(2000, 4000) // Human-like pause between steps

      // 4. Browse folders (Sent, Drafts, etc.)
      const step4Result = await this.safeAction(async () => {
        const browseSuccess = await this.browseFolders()
        return browseSuccess ? 'Đã duyệt các thư mục' : null
      }, 'browsing folders', null)

      if (step4Result) {
        careActions.push(step4Result)
      }
      await this.randomDelay(2000, 4000) // Human-like pause between steps

      // 5. Check settings (20% chance)
      if (Math.random() < 0.2) {
        const step5Result = await this.safeAction(async () => {
          const settingsSuccess = await this.checkAccountSettings()
          return settingsSuccess ? 'Đã kiểm tra settings' : null
        }, 'checking settings', null)

        if (step5Result) {
          careActions.push(step5Result)
        }
        await this.randomDelay(2000, 4000) // Human-like pause between steps
      }

      // 6. Create draft email (30% chance)
      if (Math.random() < 0.3) {
        const step6Result = await this.safeAction(async () => {
          const draftSuccess = await this.createDraftEmail()
          return draftSuccess ? 'Đã tạo draft email' : null
        }, 'creating draft', null)

        if (step6Result) {
          careActions.push(step6Result)
        }
        await this.randomDelay(2000, 4000) // Human-like pause between steps
      }

      // 7. Search Google and open Gmail (20% chance)
      if (Math.random() < 0.2) {
        const step7Result = await this.safeAction(async () => {
          const googleSearchSuccess = await this.searchGoogleAndOpenGmail()
          return googleSearchSuccess ? 'Đã tìm kiếm Google và mở Gmail' : null
        }, 'searching Google', null)

        if (step7Result) {
          careActions.push(step7Result)
        }
        await this.randomDelay(2000, 4000) // Human-like pause between steps
      }

      // 8. Open random emails
      const step8Result = await this.safeAction(async () => {
        const openedCount = await this.openRandomEmails()
        return openedCount > 0 ? `Đã mở ${openedCount} email ngẫu nhiên` : null
      }, 'opening random emails', null)

      if (step8Result) {
        careActions.push(step8Result)
      }
      await this.randomDelay(2000, 4000) // Human-like pause between steps

      // 9. Perform random Gmail actions
      const step9Result = await this.safeAction(async () => {
        const randomActions = await this.performRandomGmailActions()
        return randomActions.length > 0 ? `Đã thực hiện ${randomActions.length} hành động random` : null
      }, 'performing random actions', null)

      if (step9Result) {
        careActions.push(step9Result)
      }

      return careActions
    } catch (error) {
      console.error('[GmailCare] Error in performCare:', error)
      return careActions
    }
  }

  /**
   * Ensure we're on Gmail inbox
   */
  private async ensureGmailInbox(): Promise<void> {
    try {
      const currentUrl = this.page.url()

      // Check if we're already on Gmail
      if (currentUrl.includes('mail.google.com')) {
        // Try to find Gmail tab if multiple tabs exist
        const pages = this.page.context().pages()
        for (const p of pages) {
          const url = p.url()
          if (url.includes('mail.google.com')) {
            // Switch to this page if not already active
            if (p !== this.page) {
              // Note: Playwright doesn't have direct tab switching, but we can work with the page
              // For now, we'll just navigate if needed
            }
            break
          }
        }
      }

      // Navigate to Gmail if not already there
      if (!currentUrl.includes('mail.google.com')) {
        await this.page.goto('https://mail.google.com', {
          waitUntil: 'domcontentloaded',
          timeout: 30000,
        })
        await this.randomDelay(3000, 5000) // Increased delay after navigation (3-5s)
      }

      // Wait for inbox to load
      await this.page.waitForLoadState('domcontentloaded')
      await this.randomDelay(3000, 5000) // Increased delay for page load (3-5s)
    } catch (error) {
      console.warn('[GmailCare] Error ensuring Gmail inbox:', error)
      // Fallback: try to navigate directly
      try {
        await this.page.goto('https://mail.google.com', {
          waitUntil: 'domcontentloaded',
          timeout: 30000,
        })
        await this.randomDelay(2000, 3000)
      } catch (e) {
        console.error('[GmailCare] Fallback navigation failed:', e)
      }
    }
  }

  /**
   * Check number of unread emails
   */
  private async checkUnreadEmails(): Promise<number> {
    try {
      await this.ensureGmailInbox()

      // Try to find unread count badge
      const unreadSelectors = [
        '.bsU',
        '[aria-label*="unread"]',
        '.T-KT',
        '.n0',
      ]

      for (const selector of unreadSelectors) {
        try {
          const elements = await this.page.$$(selector)
          for (const elem of elements) {
            const text = await elem.textContent()
            if (text && /^\d+$/.test(text.trim())) {
              return parseInt(text.trim(), 10)
            }
          }
        } catch {
          continue
        }
      }

      // Count unread emails in list (tr.zA.yO:not(.zE))
      const unreadEmails = await this.page.$$('tr.zA.yO:not(.zE)')
      return unreadEmails.length
    } catch {
      return 0
    }
  }

  /**
   * Read emails
   */
  private async readEmails(count: number): Promise<number> {
    let readCount = 0
    try {
      await this.ensureGmailInbox()

      // Get list of emails using locator API
      const emailLocators = this.page.locator('tr.zA')
      const emailCount = await emailLocators.count()
      const emailsToRead = Math.min(count, emailCount)

      for (let i = 0; i < emailsToRead; i++) {
        try {
          const emailLocator = emailLocators.nth(i)

          // Scroll to email using scrollIntoViewIfNeeded
          await emailLocator.scrollIntoViewIfNeeded().catch(() => { })
          await this.randomDelay(800, 1500) // Increased delay before click

          // Click to open
          await emailLocator.click({ timeout: 5000 }).catch(() => { })
          await this.randomDelay(3000, 8000) // Increased read time (3-8 seconds) - more human-like

          // Scroll to read full content
          await this.page.evaluate(() => {
            window.scrollTo(0, document.body.scrollHeight)
          })
          await this.randomDelay(1500, 3000) // Increased scroll delay

          // Go back to list
          await this.page.goBack().catch(() => { })
          await this.randomDelay(1500, 2500) // Increased delay after back

          readCount++
        } catch (error) {
          console.warn('[GmailCare] Error reading email:', error)
          continue
        }
      }

      return readCount
    } catch (error) {
      console.warn('[GmailCare] Error in readEmails:', error)
      return readCount
    }
  }

  /**
   * Interact with emails (star, archive, etc.)
   */
  private async interactWithEmails(): Promise<boolean> {
    try {
      await this.ensureGmailInbox()

      const emailLocators = this.page.locator('tr.zA')
      const emailCount = await emailLocators.count()
      const emailsToInteract = Math.min(3, emailCount)
      let interacted = false

      for (let i = 0; i < emailsToInteract; i++) {
        try {
          const emailLocator = emailLocators.nth(i)

          // Scroll to email
          await emailLocator.scrollIntoViewIfNeeded().catch(() => { })
          await this.randomDelay(800, 1500) // Increased delay before interaction

          // Star email (30% chance)
          if (Math.random() < 0.3) {
            try {
              const starButton = emailLocator.locator('[aria-label*="Star"], [title*="Star"]').first()
              const isVisible = await starButton.isVisible().catch(() => false)
              if (isVisible) {
                const ariaLabel = await starButton.getAttribute('aria-label').catch(() => '')
                if (ariaLabel && ariaLabel.toLowerCase().includes('not starred')) {
                  await starButton.click({ timeout: 3000 }).catch(() => { })
                  await this.randomDelay(1000, 2000) // Increased delay after star
                  interacted = true
                }
              }
            } catch {
              // Ignore
            }
          }

          // Archive email (20% chance)
          if (Math.random() < 0.2) {
            try {
              const archiveButton = emailLocator.locator('[aria-label*="Archive"], [title*="Archive"]').first()
              const isVisible = await archiveButton.isVisible().catch(() => false)
              if (isVisible) {
                await archiveButton.click({ timeout: 3000 }).catch(() => { })
                await this.randomDelay(1000, 2000) // Increased delay after archive
                interacted = true
              }
            } catch {
              // Ignore
            }
          }
        } catch {
          continue
        }
      }

      return interacted
    } catch (error) {
      console.warn('[GmailCare] Error in interactWithEmails:', error)
      return false
    }
  }

  /**
   * Search emails
   */
  private async searchEmails(): Promise<boolean> {
    try {
      await this.ensureGmailInbox()

      // Find search box
      const searchSelectors = [
        '[name="q"]',
        '[aria-label*="Search"]',
        '.gb_gf',
      ]

      let searchBox = null
      for (const selector of searchSelectors) {
        try {
          searchBox = await this.page.$(selector)
          if (searchBox) break
        } catch {
          continue
        }
      }

      if (!searchBox) {
        return false
      }

      // Random keywords
      const keywords = [
        'important',
        'work',
        'newsletter',
        'unread',
        'from:me',
        'has:attachment',
      ]
      const keyword = keywords[Math.floor(Math.random() * keywords.length)]

      await this.humanType(searchBox, keyword) // Human-like typing for search
      await this.randomDelay(1000, 2000) // Increased delay before pressing Enter
      await searchBox.press('Enter')
      await this.randomDelay(3000, 5000) // Increased delay after search (3-5s)

      // Go back to inbox
      await this.page.goto('https://mail.google.com', {
        waitUntil: 'domcontentloaded',
        timeout: 30000,
      })
      await this.randomDelay(1000, 2000)

      return true
    } catch (error) {
      console.warn('[GmailCare] Error in searchEmails:', error)
      return false
    }
  }

  /**
   * Browse folders (Sent, Drafts, etc.)
   */
  private async browseFolders(): Promise<boolean> {
    try {
      await this.ensureGmailInbox()

      const folders = [
        'https://mail.google.com/mail/u/0/#sent',
        'https://mail.google.com/mail/u/0/#drafts',
        'https://mail.google.com/mail/u/0/#starred',
        'https://mail.google.com/mail/u/0/#important',
      ]

      const folder = folders[Math.floor(Math.random() * folders.length)]
      await this.page.goto(folder, {
        waitUntil: 'domcontentloaded',
        timeout: 30000,
      })
      await this.randomDelay(2000, 4000)

      // Go back to inbox
      await this.page.goto('https://mail.google.com', {
        waitUntil: 'domcontentloaded',
        timeout: 30000,
      })
      await this.randomDelay(1000, 2000)

      return true
    } catch (error) {
      console.warn('[GmailCare] Error in browseFolders:', error)
      return false
    }
  }

  /**
   * Check account settings
   */
  private async checkAccountSettings(): Promise<boolean> {
    try {
      await this.page.goto('https://myaccount.google.com/', {
        waitUntil: 'domcontentloaded',
        timeout: 30000,
      })
      await this.randomDelay(2000, 3000)

      // Scroll to view content
      await this.page.evaluate(() => {
        window.scrollTo(0, document.body.scrollHeight)
      })
      await this.randomDelay(1000, 2000)

      // Go back to Gmail
      await this.page.goto('https://mail.google.com', {
        waitUntil: 'domcontentloaded',
        timeout: 30000,
      })
      await this.randomDelay(1000, 2000)

      return true
    } catch (error) {
      console.warn('[GmailCare] Error in checkAccountSettings:', error)
      return false
    }
  }

  /**
   * Create draft email
   */
  private async createDraftEmail(): Promise<boolean> {
    try {
      await this.ensureGmailInbox()

      // Click Compose button
      const composeSelectors = [
        '[gh="cm"]',
        '.T-I.T-I-KE.L3',
        '[aria-label*="Compose"]',
        '.z0',
      ]

      let composeButton = null
      for (const selector of composeSelectors) {
        try {
          composeButton = await this.page.$(selector)
          if (composeButton) break
        } catch {
          continue
        }
      }

      if (!composeButton) {
        return false
      }

      await composeButton.click()
      await this.randomDelay(1500, 2500) // Increased delay after clicking compose

      // Fill email address with human-like typing
      const toInput = await this.page.waitForSelector('input[name="to"]', {
        timeout: 10000,
      })
      await this.humanType(toInput, this.email)
      await this.randomDelay(1500, 2500) // Increased delay after typing email

      // Fill subject with human-like typing
      const subjectInput = await this.page.$('input[name="subjectbox"]')
      if (subjectInput) {
        const now = new Date()
        const subject = `Auto draft - ${now.toISOString().slice(0, 16).replace('T', ' ')}`
        await this.humanType(subjectInput, subject)
        await this.randomDelay(1500, 2500) // Increased delay after typing subject
      }

      // Fill body with human-like typing
      const bodySelectors = [
        '[aria-label="Message Body"]',
        '.Am',
      ]
      for (const selector of bodySelectors) {
        try {
          const bodyInput = await this.page.$(selector)
          if (bodyInput) {
            await this.humanType(bodyInput, 'Auto-generated draft to keep account active.')
            await this.randomDelay(1500, 2500) // Increased delay after typing body
            break
          }
        } catch {
          continue
        }
      }

      // Close compose window (saves as draft automatically)
      const closeSelectors = [
        '[aria-label*="Close"]',
        '.Ha',
      ]
      for (const selector of closeSelectors) {
        try {
          const closeButton = await this.page.$(selector)
          if (closeButton) {
            await closeButton.click()
            await this.randomDelay(1000, 2000)
            break
          }
        } catch {
          continue
        }
      }

      return true
    } catch (error) {
      console.warn('[GmailCare] Error in createDraftEmail:', error)
      return false
    }
  }

  /**
   * Search Google and open Gmail
   */
  private async searchGoogleAndOpenGmail(): Promise<boolean> {
    try {
      const searchQueries = [
        'gmail login',
        'gmail sign in',
        'gmail.com',
        'google mail',
        `gmail ${this.email}`,
      ]

      const query = searchQueries[Math.floor(Math.random() * searchQueries.length)]
      const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}`

      await this.page.goto(searchUrl, {
        waitUntil: 'domcontentloaded',
        timeout: 30000,
      })
      await this.randomDelay(2000, 4000)

      // Find and click Gmail link
      const gmailLinksLocator = this.page.locator('a[href*="mail.google.com"], a[href*="accounts.google.com"]')
      const linkCount = await gmailLinksLocator.count()

      if (linkCount > 0) {
        const linkIndex = Math.min(Math.floor(Math.random() * 3), linkCount - 1)
        const link = gmailLinksLocator.nth(linkIndex)

        await link.scrollIntoViewIfNeeded().catch(() => { })
        await this.randomDelay(500, 1500)
        await link.click({ timeout: 5000 }).catch(() => { })
        await this.randomDelay(3000, 5000)

        // Check if we're on Gmail
        const currentUrl = this.page.url()
        if (!currentUrl.includes('mail.google.com') && !currentUrl.includes('accounts.google.com')) {
          // Navigate directly to Gmail
          await this.page.goto('https://mail.google.com', {
            waitUntil: 'domcontentloaded',
            timeout: 30000,
          })
          await this.randomDelay(1000, 2000)
        }
      } else {
        // No link found, navigate directly
        await this.page.goto('https://mail.google.com', {
          waitUntil: 'domcontentloaded',
          timeout: 30000,
        })
        await this.randomDelay(1000, 2000)
      }

      return true
    } catch (error) {
      console.warn('[GmailCare] Error in searchGoogleAndOpenGmail:', error)
      // Fallback: navigate directly to Gmail
      try {
        await this.page.goto('https://mail.google.com', {
          waitUntil: 'domcontentloaded',
          timeout: 30000,
        })
        await this.randomDelay(1000, 2000)
        return true
      } catch {
        return false
      }
    }
  }

  /**
   * Open random emails
   */
  private async openRandomEmails(): Promise<number> {
    try {
      await this.ensureGmailInbox()

      const emailLocators = this.page.locator('tr.zA')
      const emailCount = await emailLocators.count()

      if (emailCount === 0) {
        return 0
      }

      const numToOpen = Math.min(
        Math.floor(Math.random() * 5) + 1,
        emailCount
      )

      // Select random indices
      const indices = Array.from({ length: emailCount }, (_, i) => i)
      const shuffled = indices.sort(() => Math.random() - 0.5)
      const selectedIndices = shuffled.slice(0, numToOpen)

      let openedCount = 0

      for (const index of selectedIndices) {
        try {
          const emailLocator = emailLocators.nth(index)

          // Scroll to email
          await emailLocator.scrollIntoViewIfNeeded().catch(() => { })
          await this.randomDelay(800, 1500) // Increased delay before clicking

          await emailLocator.click({ timeout: 5000 }).catch(() => { })
          await this.randomDelay(3000, 8000) // Increased read time (3-8 seconds) - more human-like

          // Scroll to read
          await this.page.evaluate(() => {
            window.scrollTo(0, document.body.scrollHeight)
          })
          await this.randomDelay(1000, 2000)

          // Scroll back up
          await this.page.evaluate(() => {
            window.scrollTo(0, 0)
          })
          await this.randomDelay(500, 1000)

          // Go back
          if (Math.random() < 0.5) {
            await this.page.goBack().catch(() => { })
          } else {
            // Click inbox link
            try {
              const inboxLink = this.page.locator('a[href*="#inbox"], [aria-label*="Inbox"]').first()
              const isVisible = await inboxLink.isVisible().catch(() => false)
              if (isVisible) {
                await inboxLink.click({ timeout: 3000 }).catch(() => { })
              } else {
                await this.page.goto('https://mail.google.com', {
                  waitUntil: 'domcontentloaded',
                  timeout: 30000,
                })
              }
            } catch {
              await this.page.goto('https://mail.google.com', {
                waitUntil: 'domcontentloaded',
                timeout: 30000,
              })
            }
          }

          await this.randomDelay(1000, 2000)
          openedCount++
        } catch (error) {
          console.warn('[GmailCare] Error opening email:', error)
          continue
        }
      }

      return openedCount
    } catch (error) {
      console.warn('[GmailCare] Error in openRandomEmails:', error)
      return 0
    }
  }

  /**
   * Perform random Gmail actions
   */
  private async performRandomGmailActions(): Promise<string[]> {
    const actionsPerformed: string[] = []

    try {
      await this.ensureGmailInbox()

      // 1. Click different labels (30% chance)
      if (Math.random() < 0.3) {
        try {
          const labels = [
            { url: '#sent', name: 'Sent' },
            { url: '#drafts', name: 'Drafts' },
            { url: '#starred', name: 'Starred' },
            { url: '#important', name: 'Important' },
            { url: '#spam', name: 'Spam' },
            { url: '#trash', name: 'Trash' },
          ]

          const label = labels[Math.floor(Math.random() * labels.length)]
          await this.page.goto(`https://mail.google.com/mail/u/0/${label.url}`, {
            waitUntil: 'domcontentloaded',
            timeout: 30000,
          })
          await this.randomDelay(3000, 5000) // Increased delay when browsing folders
          actionsPerformed.push(`Mở ${label.name}`)

          // Go back to inbox
          await this.page.goto('https://mail.google.com', {
            waitUntil: 'domcontentloaded',
            timeout: 30000,
          })
          await this.randomDelay(2000, 3000) // Increased delay after returning to inbox
        } catch (error) {
          console.warn('[GmailCare] Error opening label:', error)
        }
      }

      // 2. Random scroll in inbox (50% chance)
      if (Math.random() < 0.5) {
        try {
          const scrollAmount = Math.floor(Math.random() * 600) + 200 // 200-800
          const scrollDirection = Math.random() < 0.5 ? 'down' : 'up'

          await this.page.evaluate(
            (args: { amount: number, direction: string }) => {
              if (args.direction === 'down') {
                window.scrollBy(0, args.amount)
              } else {
                window.scrollBy(0, -args.amount)
              }
            },
            { amount: scrollAmount, direction: scrollDirection }
          )
          await this.randomDelay(1000, 2000)
          actionsPerformed.push('Scroll inbox')
        } catch (error) {
          console.warn('[GmailCare] Error scrolling:', error)
        }
      }

      // 3. Hover emails (40% chance)
      if (Math.random() < 0.4) {
        try {
          const emailLocators = this.page.locator('tr.zA')
          const emailCount = await emailLocators.count()
          if (emailCount > 0) {
            const randomIndex = Math.floor(Math.random() * Math.min(5, emailCount))
            const emailToHover = emailLocators.nth(randomIndex)
            await emailToHover.scrollIntoViewIfNeeded().catch(() => { })
            await emailToHover.hover({ timeout: 3000 }).catch(() => { })
            await this.randomDelay(500, 1500)
            actionsPerformed.push('Hover email')
          }
        } catch (error) {
          console.warn('[GmailCare] Error hovering email:', error)
        }
      }

      // 4. Click read emails (30% chance)
      if (Math.random() < 0.3) {
        try {
          const readEmailLocators = this.page.locator('tr.zA.zE')
          const readEmailCount = await readEmailLocators.count()
          if (readEmailCount > 0) {
            const randomIndex = Math.min(
              Math.floor(Math.random() * 3),
              readEmailCount - 1
            )
            const emailToClick = readEmailLocators.nth(randomIndex)
            await emailToClick.scrollIntoViewIfNeeded().catch(() => { })
            await this.randomDelay(500, 1000)
            await emailToClick.click({ timeout: 5000 }).catch(() => { })
            await this.randomDelay(2000, 4000)
            actionsPerformed.push('Mở email đã đọc')

            // Go back
            await this.page.goBack().catch(() => { })
            await this.randomDelay(1000, 2000)
          }
        } catch (error) {
          console.warn('[GmailCare] Error clicking read email:', error)
        }
      }

      // 5. Check email count (20% chance)
      if (Math.random() < 0.2) {
        try {
          await this.page.evaluate(() => {
            window.scrollTo(0, document.body.scrollHeight)
          })
          await this.randomDelay(2000, 3000)
          actionsPerformed.push('Kiểm tra số lượng email')
        } catch (error) {
          console.warn('[GmailCare] Error checking email count:', error)
        }
      }
    } catch (error) {
      console.warn('[GmailCare] Error in performRandomGmailActions:', error)
    }

    return actionsPerformed
  }

  /**
   * Random delay helper based on behavior level
   * Improved with more human-like ranges
   */
  private async randomDelay(minMs: number, maxMs: number): Promise<void> {
    const baseDelay = Math.random() * (maxMs - minMs) + minMs

    // Adjust delay based on randomBehaviorLevel
    let multiplier = 1.0
    switch (this.randomBehaviorLevel) {
      case 'low':
        multiplier = 0.7 // Faster
        break
      case 'medium':
        multiplier = 1.0 // Normal
        break
      case 'high':
        multiplier = 1.5 // Slower, more human-like
        break
    }

    const delay = baseDelay * multiplier
    await this.page.waitForTimeout(delay)
  }

  /**
   * Human-like typing - types character by character with random delays
   */
  private async humanType(element: any, text: string): Promise<void> {
    for (const char of text) {
      await element.type(char, { delay: 50 + Math.random() * 100 }) // 50-150ms per character
    }
  }

  /**
   * Classify error type for smart error handling
   */
  private classifyError(error: any): ErrorType {
    const errorMessage = error?.message || String(error).toLowerCase()

    // Timeout errors - can skip and continue
    if (
      errorMessage.includes('timeout') ||
      errorMessage.includes('waiting for') ||
      errorMessage.includes('element not found') ||
      errorMessage.includes('selector') ||
      errorMessage.includes('no such element')
    ) {
      return ErrorType.SKIP_AND_CONTINUE
    }

    // Network errors - can retry once
    if (
      errorMessage.includes('network') ||
      errorMessage.includes('connection') ||
      errorMessage.includes('navigation') ||
      errorMessage.includes('page crashed')
    ) {
      return ErrorType.RETRY_ONCE
    }

    // Other errors - skip by default (most are non-critical)
    return ErrorType.SKIP_AND_CONTINUE
  }

  /**
   * Safe action wrapper with error handling
   */
  private async safeAction<T>(
    action: () => Promise<T>,
    actionName: string,
    defaultValue: T
  ): Promise<T> {
    try {
      return await action()
    } catch (error) {
      const errorType = this.classifyError(error)

      if (errorType === ErrorType.RETRY_ONCE) {
        // Retry once after a short delay
        await this.randomDelay(1000, 2000)
        try {
          return await action()
        } catch (retryError) {
          console.warn(`[GmailCare] ${actionName} failed after retry:`, retryError)
          return defaultValue
        }
      } else if (errorType === ErrorType.SKIP_AND_CONTINUE) {
        console.warn(`[GmailCare] Skipping ${actionName} due to non-critical error:`, (error as any)?.message || error)
        return defaultValue
      } else {
        // Fatal error - log but still return default to continue
        console.error(`[GmailCare] Fatal error in ${actionName}:`, error)
        return defaultValue
      }
    }
  }
}

