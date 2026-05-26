/**
 * ActionRecorder - Records browser automation actions
 * 
 * Captures user interactions and browser events to create replayable recordings
 */

import type { Page } from 'playwright'
import {
  Action,
  ActionRecording,
  ActionType,
  generateActionId,
  RecordingMetadata,
  RecordingConfig,
} from './ActionTypes'

export interface ActionRecorderOptions {
  metadata?: Partial<RecordingMetadata>
  config?: RecordingConfig
  screenshotOnAction?: boolean    // Take screenshot before/after each action
  screenshotDir?: string          // Directory to save screenshots
}

export class ActionRecorder {
  private page: Page
  private actions: Action[] = []
  private startTime: number = 0
  private isRecording: boolean = false
  private options: ActionRecorderOptions
  private listeners: Array<() => void> = []

  constructor(page: Page, options: ActionRecorderOptions = {}) {
    this.page = page
    this.options = {
      screenshotOnAction: false,
      ...options,
    }
  }

  /**
   * Start recording actions
   */
  async start(): Promise<void> {
    if (this.isRecording) {
      throw new Error('Recording already in progress')
    }

    this.isRecording = true
    this.startTime = Date.now()
    this.actions = []

    // Attach event listeners
    await this.attachListeners()

    console.log('[ActionRecorder] Recording started')
  }

  /**
   * Stop recording and return the recording data
   */
  async stop(): Promise<ActionRecording> {
    if (!this.isRecording) {
      throw new Error('No recording in progress')
    }

    this.isRecording = false
    this.detachListeners()

    const duration = Date.now() - this.startTime

    const metadata: RecordingMetadata = {
      name: this.options.metadata?.name || `Recording ${new Date().toISOString()}`,
      description: this.options.metadata?.description,
      accountType: this.options.metadata?.accountType,
      url: this.options.metadata?.url || this.page.url(),
      author: this.options.metadata?.author,
      tags: this.options.metadata?.tags || [],
      version: this.options.metadata?.version || '1.0.0',
    }

    const recording: ActionRecording = {
      version: '1.0.0',
      metadata,
      actions: this.actions,
      config: this.options.config,
    }

    console.log(`[ActionRecorder] Recording stopped. ${this.actions.length} actions recorded.`)

    return recording
  }

  /**
   * Manually add an action to the recording
   */
  addAction(action: Omit<Action, 'id' | 'timestamp'>): void {
    if (!this.isRecording) {
      throw new Error('Not recording. Call start() first.')
    }

    const fullAction: Action = {
      ...action,
      id: generateActionId(),
      timestamp: Date.now() - this.startTime,
    } as Action

    this.actions.push(fullAction)
  }

  /**
   * Get current recording status
   */
  getStatus(): { isRecording: boolean; actionCount: number; duration: number } {
    return {
      isRecording: this.isRecording,
      actionCount: this.actions.length,
      duration: this.isRecording ? Date.now() - this.startTime : 0,
    }
  }

  /**
   * Attach event listeners to capture browser actions
   */
  private async attachListeners(): Promise<void> {
    // Listen for navigation
    this.page.on('framenavigated', (frame) => {
      if (frame === this.page.mainFrame() && this.isRecording) {
        const url = frame.url()
        if (url && url !== 'about:blank') {
          this.addAction({
            type: 'navigate',
            url,
            description: `Navigate to ${url}`,
          } as any)
        }
      }
    })

    // Listen for console messages (optional - for debugging)
    this.page.on('console', (msg) => {
      if (this.isRecording && this.options.config?.screenshotOnError) {
        // Can capture console errors if needed
      }
    })

    // Note: Playwright doesn't expose click/type events directly
    // We'll use manual recording via addAction() for user interactions
    // Or we can intercept via page.evaluate() to inject event listeners
  }

  /**
   * Detach all event listeners
   */
  private detachListeners(): void {
    // Remove all listeners
    this.page.removeAllListeners('framenavigated')
    this.page.removeAllListeners('console')

    // Clear stored listener cleanup functions
    this.listeners.forEach((cleanup) => cleanup())
    this.listeners = []
  }

  /**
   * Helper to get selector for an element
   */
  private async getElementSelector(element: any): Promise<string | null> {
    try {
      // Try to generate a unique selector for the element
      const selector = await this.page.evaluate((el: Element) => {
        // Generate CSS selector
        function generateSelector(element: Element): string | null {
          if (element.id) {
            return `#${element.id}`
          }

          if (element.className && typeof element.className === 'string') {
            const classes = element.className
              .trim()
              .split(/\s+/)
              .filter((c) => c.length > 0)
              .join('.')
            if (classes) {
              const tagName = element.tagName.toLowerCase()
              return `${tagName}.${classes}`
            }
          }

          // Use tag name + nth-child as fallback
          const tagName = element.tagName.toLowerCase()
          const parent = element.parentElement
          if (parent) {
            const siblings = Array.from(parent.children)
            const index = siblings.indexOf(element) + 1
            return `${tagName}:nth-child(${index})`
          }

          return tagName
        }

        return generateSelector(el)
      }, element)

      return selector
    } catch {
      return null
    }
  }

  /**
   * Helper to take screenshot if enabled
   */
  private async takeScreenshot(name: string): Promise<string | undefined> {
    if (!this.options.screenshotOnAction || !this.options.screenshotDir) {
      return undefined
    }

    try {
      const fs = await import('fs/promises')
      const path = await import('path')

      const screenshotPath = path.join(
        this.options.screenshotDir!,
        `${name}_${Date.now()}.png`
      )

      await this.page.screenshot({ path: screenshotPath, fullPage: false })
      return screenshotPath
    } catch (error) {
      console.warn('[ActionRecorder] Failed to take screenshot:', error)
      return undefined
    }
  }
}

/**
 * Helper function to record a click action
 */
export async function recordClick(
  recorder: ActionRecorder,
  page: Page,
  selector: string,
  options?: { description?: string }
): Promise<void> {
  const screenshotBefore = await recorder['takeScreenshot']('click_before')

  recorder.addAction({
    type: 'click',
    selector,
    description: options?.description || `Click on ${selector}`,
    screenshotBefore,
  })
}

/**
 * Helper function to record a type action
 */
export function recordType(
  recorder: ActionRecorder,
  selector: string,
  text: string,
  options?: { description?: string; delay?: number }
): void {
  recorder.addAction({
    type: 'type',
    selector,
    text,
    description: options?.description || `Type into ${selector}`,
    options: {
      delay: options?.delay,
    },
  } as any)
}

/**
 * Helper function to record navigation
 */
export function recordNavigate(
  recorder: ActionRecorder,
  url: string,
  options?: { description?: string }
): void {
  recorder.addAction({
    type: 'navigate',
    url,
    description: options?.description || `Navigate to ${url}`,
  } as any)
}

/**
 * Helper function to record wait
 */
export function recordWait(
  recorder: ActionRecorder,
  duration: number,
  options?: { description?: string }
): void {
  recorder.addAction({
    type: 'wait',
    duration,
    description: options?.description || `Wait ${duration}ms`,
  } as any)
}

