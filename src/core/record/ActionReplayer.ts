/**
 * ActionReplayer - Replays recorded browser automation actions
 * 
 * Executes previously recorded actions in sequence
 */

import type { Page } from 'playwright'
import {
  Action,
  ActionRecording,
  ActionType,
  ReplayResult,
  validateAction,
} from './ActionTypes'

export interface ActionReplayerOptions {
  speedMultiplier?: number      // 1.0 = normal speed, 2.0 = 2x speed, 0.5 = half speed
  stopOnError?: boolean         // Stop replaying on first error
  retryOnError?: boolean        // Retry failed actions
  retryCount?: number           // Number of retries
  retryDelay?: number           // Delay before retry (ms)
  skipWaitActions?: boolean     // Skip wait actions (for faster replay)
  logActions?: boolean          // Log each action as it's executed
}

export class ActionReplayer {
  private page: Page
  private options: Required<ActionReplayerOptions>
  private onProgress?: (progress: {
    current: number
    total: number
    action: Action
    status: 'running' | 'completed' | 'failed'
  }) => void

  constructor(page: Page, options: ActionReplayerOptions = {}) {
    this.page = page
    this.options = {
      speedMultiplier: options.speedMultiplier || 1.0,
      stopOnError: options.stopOnError !== false,
      retryOnError: options.retryOnError || false,
      retryCount: options.retryCount || 3,
      retryDelay: options.retryDelay || 1000,
      skipWaitActions: options.skipWaitActions || false,
      logActions: options.logActions !== false,
    }
  }

  /**
   * Set progress callback
   */
  onProgressCallback(
    callback: (progress: {
      current: number
      total: number
      action: Action
      status: 'running' | 'completed' | 'failed'
    }) => void
  ): void {
    this.onProgress = callback
  }

  /**
   * Replay a recording
   */
  async replay(recording: ActionRecording): Promise<ReplayResult> {
    const startTime = Date.now()
    const result: ReplayResult = {
      success: true,
      actionsExecuted: 0,
      actionsFailed: 0,
      errors: [],
    }

    const actions = recording.actions
    const totalActions = actions.length

    console.log(`[ActionReplayer] Starting replay of ${totalActions} actions...`)

    for (let i = 0; i < actions.length; i++) {
      const action = actions[i]

      // Validate action
      const validation = validateAction(action)
      if (!validation.valid) {
        console.error(`[ActionReplayer] Invalid action at index ${i}:`, validation.error)
        result.actionsFailed++
        result.errors.push({
          actionIndex: i,
          actionType: action.type,
          error: validation.error || 'Invalid action',
        })

        if (this.options.stopOnError) {
          result.success = false
          break
        }
        continue
      }

      // Calculate wait time based on previous action timing
      if (i > 0 && !this.options.skipWaitActions) {
        const prevAction = actions[i - 1]
        const waitTime = (action.timestamp - prevAction.timestamp) / this.options.speedMultiplier

        if (waitTime > 0 && waitTime < 60000) {
          // Wait max 60 seconds between actions
          await this.page.waitForTimeout(waitTime)
        }
      }

      // Notify progress
      if (this.onProgress) {
        this.onProgress({
          current: i + 1,
          total: totalActions,
          action,
          status: 'running',
        })
      }

      if (this.options.logActions) {
        console.log(`[ActionReplayer] [${i + 1}/${totalActions}] Executing: ${action.type}${action.selector ? ` (${action.selector})` : ''}`)
      }

      // Execute action with retry logic
      let executed = false
      let lastError: Error | null = null

      for (let attempt = 0; attempt <= (this.options.retryOnError ? this.options.retryCount : 0); attempt++) {
        try {
          await this.executeAction(action, recording.config)
          executed = true
          result.actionsExecuted++

          if (this.onProgress) {
            this.onProgress({
              current: i + 1,
              total: totalActions,
              action,
              status: 'completed',
            })
          }
          break
        } catch (error) {
          lastError = error instanceof Error ? error : new Error(String(error))

          if (attempt < (this.options.retryOnError ? this.options.retryCount : 0)) {
            // Wait before retry
            await this.page.waitForTimeout(this.options.retryDelay)
            if (this.options.logActions) {
              console.log(`[ActionReplayer] Retry attempt ${attempt + 1}/${this.options.retryCount} for action ${i + 1}`)
            }
          }
        }
      }

      if (!executed && lastError) {
        result.actionsFailed++
        result.errors.push({
          actionIndex: i,
          actionType: action.type,
          error: lastError.message,
          timestamp: Date.now(),
        })

        if (this.options.stopOnError) {
          result.success = false
          break
        }
      }
    }

    result.durationMs = Date.now() - startTime

    console.log(
      `[ActionReplayer] Replay completed. Executed: ${result.actionsExecuted}, Failed: ${result.actionsFailed}`
    )

    return result
  }

  /**
   * Execute a single action
   */
  private async executeAction(action: Action, config?: { defaultTimeout?: number }): Promise<void> {
    const defaultTimeout = config?.defaultTimeout || 30000

    switch (action.type) {
      case 'navigate':
        await this.page.goto(action.url, {
          waitUntil: action.waitUntil || 'domcontentloaded',
          timeout: action.timeout || defaultTimeout,
        })
        break

      case 'click':
        await this.page.click(action.selector!, {
          button: action.options?.button || 'left',
          clickCount: action.options?.clickCount || 1,
          delay: action.options?.delay,
          timeout: action.options?.timeout || defaultTimeout,
          force: action.options?.force,
        })
        break

      case 'type':
        if (action.options?.clearFirst) {
          await this.page.fill(action.selector!, '')
          await this.page.waitForTimeout(100)
        }
        await this.page.type(action.selector!, action.text, {
          delay: action.options?.delay,
          timeout: action.options?.timeout || defaultTimeout,
        })
        break

      case 'fill':
        await this.page.fill(action.selector!, action.value, {
          timeout: action.options?.timeout || defaultTimeout,
          force: action.options?.force,
        })
        break

      case 'select':
        if (Array.isArray(action.value)) {
          await this.page.selectOption(action.selector!, action.value, {
            timeout: action.options?.timeout || defaultTimeout,
          })
        } else {
          await this.page.selectOption(action.selector!, action.value, {
            timeout: action.options?.timeout || defaultTimeout,
          })
        }
        break

      case 'wait':
        await this.page.waitForTimeout(action.duration)
        break

      case 'waitForSelector':
        await this.page.waitForSelector(action.selector!, {
          state: action.options?.state || 'visible',
          timeout: action.options?.timeout || defaultTimeout,
        })
        break

      case 'waitForNavigation':
        await this.page.waitForURL(action.options?.url || /.*/, {
          waitUntil: action.options?.waitUntil || 'domcontentloaded',
          timeout: action.options?.timeout || defaultTimeout,
        })
        break

      case 'screenshot':
        if (action.path) {
          await this.page.screenshot({
            path: action.path,
            fullPage: action.options?.fullPage || false,
            clip: action.options?.clip,
          })
        }
        break

      case 'scroll':
        if (action.options?.selector) {
          await this.page.locator(action.options.selector).scrollIntoViewIfNeeded({
            timeout: defaultTimeout,
          })
        } else if (action.options?.x !== undefined || action.options?.y !== undefined) {
          await this.page.evaluate(
            ({ x, y }) => {
              window.scrollTo(x || 0, y || 0)
            },
            { x: action.options?.x, y: action.options?.y }
          )
        } else {
          // Scroll down a bit
          await this.page.evaluate(() => {
            window.scrollBy(0, 300)
          })
        }
        break

      case 'hover':
        await this.page.hover(action.selector!, {
          timeout: action.options?.timeout || defaultTimeout,
          force: action.options?.force,
        })
        break

      case 'keyboard':
        const modifiers = action.options?.modifiers || []
        await this.page.keyboard.press(action.key, {
          delay: action.options?.delay,
        })
        break

      case 'evaluate':
        await this.page.evaluate(action.script, ...(action.args || []))
        break

      case 'assert':
        const result = await this.page.evaluate((condition: string) => {
          return eval(condition)
        }, action.condition)

        if (action.expectedValue !== undefined && result !== action.expectedValue) {
          throw new Error(
            action.message ||
            `Assertion failed: expected ${action.expectedValue}, got ${result}`
          )
        }
        break

      case 'doubleClick':
        await this.page.dblclick(action.selector!, {
          timeout: action.options?.timeout || defaultTimeout,
          force: action.options?.force,
        })
        break

      case 'rightClick':
        await this.page.click(action.selector!, {
          button: 'right',
          timeout: action.options?.timeout || defaultTimeout,
          force: action.options?.force,
        })
        break

      case 'drag':
        const sourceLocator = this.page.locator(action.sourceSelector)
        const targetLocator = this.page.locator(action.targetSelector)
        await sourceLocator.dragTo(targetLocator, {
          timeout: action.options?.timeout || defaultTimeout,
        })
        break

      default:
        throw new Error(`Unknown action type: ${(action as any).type}`)
    }
  }
}

