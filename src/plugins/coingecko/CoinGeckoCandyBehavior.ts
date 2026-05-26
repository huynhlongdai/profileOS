/**
 * CoinGeckoCandyBehavior - Human-like behavior for CoinGecko Candy interactions
 * 
 * Similar to GmailCareBehavior, this implements random, human-like interactions
 * to make the automation less detectable.
 */

type Page = any // Playwright Page type

export interface CoinGeckoCandyBehaviorOptions {
  randomBehaviorLevel?: 'low' | 'medium' | 'high'
}

enum ErrorType {
  SKIP_AND_CONTINUE = 'skip',
  RETRY_ONCE = 'retry',
  FATAL = 'fatal',
}

/**
 * CoinGeckoCandyBehavior - Implements human-like interactions on CoinGecko
 */
export class CoinGeckoCandyBehavior {
  private page: Page
  private randomBehaviorLevel: 'low' | 'medium' | 'high'

  constructor(page: Page, options?: CoinGeckoCandyBehaviorOptions) {
    this.page = page
    this.randomBehaviorLevel = options?.randomBehaviorLevel || 'medium'
  }

  /**
   * Random delay with configurable range based on behavior level
   */
  private async randomDelay(minMs: number, maxMs: number): Promise<void> {
    const multiplier = this.randomBehaviorLevel === 'low' ? 0.7 : this.randomBehaviorLevel === 'high' ? 1.5 : 1.0
    const delay = (minMs + Math.random() * (maxMs - minMs)) * multiplier
    await this.page.waitForTimeout(Math.round(delay))
  }

  /**
   * Human-like typing simulation
   */
  private async humanType(element: any, text: string): Promise<void> {
    for (const char of text) {
      await element.type(char, { delay: 50 + Math.random() * 100 })
    }
  }

  /**
   * Classify error to determine handling strategy
   */
  private classifyError(error: any): ErrorType {
    const errorMessage = error?.message || String(error)
    const errorName = error?.name || ''

    // Timeout errors - usually safe to skip
    if (errorName.includes('Timeout') || errorMessage.includes('timeout')) {
      return ErrorType.SKIP_AND_CONTINUE
    }

    // Element not found - safe to skip
    if (errorName.includes('Locator') || errorMessage.includes('not found') || errorMessage.includes('not visible')) {
      return ErrorType.SKIP_AND_CONTINUE
    }

    // Network errors - retry once
    if (errorName.includes('Network') || errorMessage.includes('net::') || errorMessage.includes('ERR_')) {
      return ErrorType.RETRY_ONCE
    }

    // Unknown errors - skip by default
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
      console.warn(`[CoinGeckoCandyBehavior] Error ${actionName}:`, error)

      if (errorType === ErrorType.RETRY_ONCE) {
        try {
          await this.randomDelay(1000, 2000)
          return await action()
        } catch (retryError) {
          console.warn(`[CoinGeckoCandyBehavior] Retry failed for ${actionName}:`, retryError)
          return defaultValue
        }
      }

      return defaultValue
    }
  }

  /**
   * Scroll page randomly like a human
   */
  async randomScroll(): Promise<void> {
    await this.safeAction(async () => {
      const scrollAmount = 200 + Math.random() * 400
      const scrollDirection = Math.random() > 0.5 ? 1 : -1
      await this.page.evaluate((amount: number) => {
        window.scrollBy(0, amount)
      }, scrollAmount * scrollDirection)
      await this.randomDelay(800, 1500)
    }, 'random scroll', undefined)
  }

  /**
   * Browse rewards page randomly
   */
  async browseRewards(): Promise<void> {
    await this.safeAction(async () => {
      // Look for "Browse Rewards" link
      const browseRewardsSelectors = [
        'a:has-text("Browse Rewards")',
        'a[href*="/rewards"]',
        'a:has-text("Rewards")',
      ]

      for (const selector of browseRewardsSelectors) {
        try {
          const element = await this.page.$(selector)
          if (element) {
            await element.click()
            await this.randomDelay(2000, 3000)
            await this.page.waitForLoadState('domcontentloaded')
            await this.randomDelay(2000, 3000)

            // Scroll through rewards
            for (let i = 0; i < 2 + Math.floor(Math.random() * 3); i++) {
              await this.randomScroll()
            }

            // Go back to candy page
            await this.page.goBack()
            await this.randomDelay(2000, 3000)
            await this.page.waitForLoadState('domcontentloaded')
            break
          }
        } catch {
          // Continue
        }
      }
    }, 'browse rewards', undefined)
  }

  /**
   * View candy balance and stats
   */
  async viewCandyStats(): Promise<void> {
    await this.safeAction(async () => {
      // Look for candy balance or stats elements
      const statsSelectors = [
        '[data-testid="candy-balance"]',
        '.candy-balance',
        ':has-text("Candy")',
      ]

      for (const selector of statsSelectors) {
        try {
          const element = await this.page.$(selector)
          if (element) {
            // Hover over to see more info
            await element.hover()
            await this.randomDelay(1000, 2000)
            break
          }
        } catch {
          // Continue
        }
      }

      // Scroll to see candy info
      await this.randomScroll()
    }, 'view candy stats', undefined)
  }

  /**
   * Random mouse movements and clicks
   */
  async randomMouseActivity(): Promise<void> {
    await this.safeAction(async () => {
      // Random mouse movements
      for (let i = 0; i < 2 + Math.floor(Math.random() * 3); i++) {
        const x = Math.random() * 800
        const y = Math.random() * 600
        await this.page.mouse.move(x, y, { steps: 5 + Math.floor(Math.random() * 10) })
        await this.randomDelay(300, 800)
      }
    }, 'random mouse activity', undefined)
  }

  /**
   * Perform random interactions after claiming candy
   */
  async performRandomInteractions(): Promise<void> {
    const interactions: Array<() => Promise<void>> = []

    // 30% chance to browse rewards
    if (Math.random() < 0.3) {
      interactions.push(() => this.browseRewards())
    }

    // 50% chance to view candy stats
    if (Math.random() < 0.5) {
      interactions.push(() => this.viewCandyStats())
    }

    // 40% chance for random scrolls
    if (Math.random() < 0.4) {
      interactions.push(async () => {
        for (let i = 0; i < 2 + Math.floor(Math.random() * 3); i++) {
          await this.randomScroll()
        }
      })
    }

    // 30% chance for random mouse activity
    if (Math.random() < 0.3) {
      interactions.push(() => this.randomMouseActivity())
    }

    // Execute interactions in random order
    const shuffled = interactions.sort(() => Math.random() - 0.5)

    for (const interaction of shuffled) {
      await interaction()
      await this.randomDelay(1000, 2000) // Pause between interactions
    }
  }
}

