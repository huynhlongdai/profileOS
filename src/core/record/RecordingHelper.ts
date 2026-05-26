/**
 * RecordingHelper - Helper utilities for recording browser actions
 * 
 * Provides easy-to-use functions to wrap browser automation with recording
 */

import type { Page } from 'playwright'
import { ActionRecorder } from './ActionRecorder'
import { ActionRecordingService } from '../services/ActionRecordingService'
import type { Action } from './ActionTypes'

export interface RecordingSession {
  recorder: ActionRecorder
  stopAndSave: () => Promise<string> // Returns recording ID
}

export class RecordingHelper {
  private recordingService: ActionRecordingService

  constructor() {
    this.recordingService = new ActionRecordingService()
  }

  /**
   * Start a recording session
   * 
   * @param page Playwright page instance
   * @param options Recording options (name, description, accountType, etc.)
   * @returns RecordingSession with recorder and stopAndSave function
   * 
   * @example
   * const session = await recordingHelper.startRecording(page, {
   *   name: 'Gmail Login Flow',
   *   accountType: 'gmail',
   *   description: 'Record Gmail login process'
   * })
   * 
   * // Perform actions...
   * await page.click('button[type="submit"]')
   * session.recorder.addAction({
   *   type: 'click',
   *   selector: 'button[type="submit"]',
   *   description: 'Click login button'
   * })
   * 
   * // Stop and save
   * const recordingId = await session.stopAndSave()
   */
  async startRecording(
    page: Page,
    options: {
      name: string
      description?: string
      accountType?: string
      url?: string
      author?: string
      tags?: string[]
      screenshotOnAction?: boolean
    }
  ): Promise<RecordingSession> {
    const recorder = new ActionRecorder(page, {
      metadata: {
        name: options.name,
        description: options.description,
        accountType: options.accountType,
        url: options.url,
        author: options.author,
        tags: options.tags || [],
      },
      screenshotOnAction: options.screenshotOnAction || false,
    })

    await recorder.start()

    return {
      recorder,
      stopAndSave: async () => {
        const recording = await recorder.stop()

        // Save to database
        const saved = await this.recordingService.createRecording({
          name: recording.metadata.name,
          description: recording.metadata.description,
          accountType: recording.metadata.accountType,
          url: recording.metadata.url,
          version: recording.metadata.version,
          author: recording.metadata.author,
          tags: recording.metadata.tags,
          actions: recording.actions,
          config: recording.config,
        })

        console.log(`[RecordingHelper] Recording saved with ID: ${saved.id}`)
        return saved.id
      },
    }
  }

  /**
   * Record a click action manually
   */
  recordClick(
    recorder: ActionRecorder,
    selector: string,
    description?: string
  ): void {
    recorder.addAction({
      type: 'click',
      selector,
      description: description || `Click on ${selector}`,
    })
  }

  /**
   * Record a type/fill action manually
   */
  recordType(
    recorder: ActionRecorder,
    selector: string,
    text: string,
    description?: string
  ): void {
    recorder.addAction({
      type: 'type',
      selector,
      text,
      description: description || `Type into ${selector}`,
    } as any)
  }

  /**
   * Record navigation
   */
  recordNavigate(recorder: ActionRecorder, url: string, description?: string): void {
    recorder.addAction({
      type: 'navigate',
      url,
      description: description || `Navigate to ${url}`,
    } as any)
  }

  /**
   * Record wait
   */
  recordWait(recorder: ActionRecorder, duration: number, description?: string): void {
    recorder.addAction({
      type: 'wait',
      duration,
      description: description || `Wait ${duration}ms`,
    } as any)
  }

  /**
   * Wrap a function to automatically record actions
   * 
   * @example
   * const wrappedClick = recordingHelper.wrapAction(page, session.recorder, 'click')
   * await wrappedClick('button.submit', {}, 'Click submit button')
   */
  wrapAction(
    page: Page,
    recorder: ActionRecorder,
    actionType: 'click' | 'fill' | 'type' | 'select'
  ) {
    if (actionType === 'click') {
      return async (selector: string, options?: any, description?: string) => {
        // Record the action before executing
        recorder.addAction({
          type: 'click',
          selector,
          description: description || options?.description || `Click on ${selector}`,
          options: {
            button: options?.button,
            clickCount: options?.clickCount,
            delay: options?.delay,
            force: options?.force,
            timeout: options?.timeout,
          },
        } as any)
        return await page.click(selector, options)
      }
    } else if (actionType === 'fill') {
      return async (selector: string, options?: { value: string;[key: string]: any }, description?: string) => {
        recorder.addAction({
          type: 'fill',
          selector,
          value: options?.value || '',
          description: description || options?.description || `Fill ${selector}`,
          options: {
            force: options?.force,
            timeout: options?.timeout,
          },
        } as any)
        const { value, ...playwrightOptions } = options || {}
        return await page.fill(selector, value || '', playwrightOptions)
      }
    } else if (actionType === 'type') {
      return async (selector: string, options?: { text: string; delay?: number;[key: string]: any }, description?: string) => {
        recorder.addAction({
          type: 'type',
          selector,
          text: options?.text || '',
          description: description || options?.description || `Type into ${selector}`,
          options: {
            delay: options?.delay,
          },
        } as any)
        const { text, ...playwrightOptions } = options || {}
        return await page.type(selector, text || '', playwrightOptions)
      }
    } else if (actionType === 'select') {
      return async (selector: string, options?: { value: string | string[];[key: string]: any }, description?: string) => {
        recorder.addAction({
          type: 'select',
          selector,
          value: options?.value || '',
          description: description || options?.description || `Select from ${selector}`,
        } as any)
        const { value, ...playwrightOptions } = options || {}
        return await page.selectOption(selector, value || '', playwrightOptions)
      }
    }

    throw new Error(`Unsupported action type: ${actionType}`)
  }
}

