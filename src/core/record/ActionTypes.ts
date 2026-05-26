/**
 * ActionTypes - Type definitions for browser automation actions
 * 
 * Defines all action types that can be recorded and replayed
 */

/**
 * Action Types supported by the recording system
 */
export type ActionType =
  | 'navigate'        // Navigate to URL
  | 'click'           // Click on element
  | 'type'            // Type text
  | 'fill'            // Fill form field
  | 'select'          // Select option from dropdown
  | 'wait'            // Wait for duration
  | 'waitForSelector' // Wait for element to appear
  | 'waitForNavigation' // Wait for navigation
  | 'screenshot'      // Take screenshot
  | 'scroll'          // Scroll page
  | 'hover'           // Hover over element
  | 'keyboard'        // Press keyboard key
  | 'evaluate'        // Execute JavaScript
  | 'assert'          // Assert condition
  | 'doubleClick'     // Double click
  | 'rightClick'      // Right click
  | 'drag'            // Drag and drop
  // GPM Automate inspired actions
  | 'clipboard'       // Clipboard operations (read/write)
  | 'cookie'          // Cookie operations (get/set/delete)
  | 'alert'           // Handle browser alerts
  | 'fileRead'        // Read file content
  | 'fileWrite'       // Write file content
  | 'httpRequest'     // HTTP request
  | 'imageSearch'     // Image search (template matching)
  | 'switchTab'       // Switch between browser tabs
  | 'setVariable'     // Set variable value
  | 'getVariable'     // Get variable value

/**
 * Base action interface
 */
export interface BaseAction {
  id: string                    // Unique ID for this action
  type: ActionType
  timestamp: number            // Timestamp in recording (ms from start)
  selector?: string            // CSS selector or XPath
  description?: string         // Human-readable description
  screenshotBefore?: string    // Screenshot path before action (optional)
  screenshotAfter?: string     // Screenshot path after action (optional)
}

/**
 * Navigate to URL
 */
export interface NavigateAction extends BaseAction {
  type: 'navigate'
  url: string
  waitUntil?: 'load' | 'domcontentloaded' | 'networkidle'
  timeout?: number
}

/**
 * Click on element
 */
export interface ClickAction extends BaseAction {
  type: 'click'
  selector: string
  options?: {
    button?: 'left' | 'right' | 'middle'
    clickCount?: number
    delay?: number
    timeout?: number
    force?: boolean
  }
}

/**
 * Type text into element
 */
export interface TypeAction extends BaseAction {
  type: 'type'
  selector: string
  text: string
  options?: {
    delay?: number             // Delay between keystrokes (ms)
    clearFirst?: boolean       // Clear field before typing
    timeout?: number
  }
}

/**
 * Fill form field
 */
export interface FillAction extends BaseAction {
  type: 'fill'
  selector: string
  value: string
  options?: {
    timeout?: number
    force?: boolean
  }
}

/**
 * Select option from dropdown
 */
export interface SelectAction extends BaseAction {
  type: 'select'
  selector: string
  value: string | string[]     // Value(s) to select
  options?: {
    timeout?: number
  }
}

/**
 * Wait for duration
 */
export interface WaitAction extends BaseAction {
  type: 'wait'
  duration: number            // Milliseconds
}

/**
 * Wait for selector to appear/disappear
 */
export interface WaitForSelectorAction extends BaseAction {
  type: 'waitForSelector'
  selector: string
  options?: {
    state?: 'visible' | 'hidden' | 'attached' | 'detached'
    timeout?: number
  }
}

/**
 * Wait for navigation
 */
export interface WaitForNavigationAction extends BaseAction {
  type: 'waitForNavigation'
  options?: {
    url?: string | RegExp
    waitUntil?: 'load' | 'domcontentloaded' | 'networkidle'
    timeout?: number
  }
}

/**
 * Take screenshot
 */
export interface ScreenshotAction extends BaseAction {
  type: 'screenshot'
  path?: string               // Path to save screenshot
  options?: {
    fullPage?: boolean
    clip?: {
      x: number
      y: number
      width: number
      height: number
    }
  }
}

/**
 * Scroll page
 */
export interface ScrollAction extends BaseAction {
  type: 'scroll'
  options?: {
    x?: number
    y?: number
    selector?: string         // Scroll element into view
    behavior?: 'auto' | 'smooth'
  }
}

/**
 * Hover over element
 */
export interface HoverAction extends BaseAction {
  type: 'hover'
  selector: string
  options?: {
    timeout?: number
    force?: boolean
  }
}

/**
 * Press keyboard key
 */
export interface KeyboardAction extends BaseAction {
  type: 'keyboard'
  key: string                 // Key name (e.g., 'Enter', 'Escape', 'Tab')
  options?: {
    delay?: number
    modifiers?: ('Control' | 'Shift' | 'Alt' | 'Meta')[]
  }
}

/**
 * Execute JavaScript
 */
export interface EvaluateAction extends BaseAction {
  type: 'evaluate'
  script: string              // JavaScript code to execute
  args?: any[]                // Arguments to pass to script
}

/**
 * Assert condition
 */
export interface AssertAction extends BaseAction {
  type: 'assert'
  condition: string           // JavaScript expression to evaluate
  expectedValue?: any         // Expected value for assertion
  message?: string            // Error message if assertion fails
}

/**
 * Double click
 */
export interface DoubleClickAction extends BaseAction {
  type: 'doubleClick'
  selector: string
  options?: {
    timeout?: number
    force?: boolean
  }
}

/**
 * Right click
 */
export interface RightClickAction extends BaseAction {
  type: 'rightClick'
  selector: string
  options?: {
    timeout?: number
    force?: boolean
  }
}

/**
 * Drag and drop
 */
export interface DragAction extends BaseAction {
  type: 'drag'
  sourceSelector: string      // Source element selector
  targetSelector: string      // Target element selector
  options?: {
    timeout?: number
  }
}

/**
 * Clipboard operations (GPM Automate inspired)
 */
export interface ClipboardAction extends BaseAction {
  type: 'clipboard'
  operation: 'read' | 'write' | 'clear'
  value?: string              // Value to write (for write operation)
  description?: string
}

/**
 * Cookie operations (GPM Automate inspired)
 */
export interface CookieAction extends BaseAction {
  type: 'cookie'
  operation: 'get' | 'set' | 'delete' | 'getAll'
  name?: string               // Cookie name
  value?: string              // Cookie value (for set operation)
  domain?: string             // Cookie domain
  path?: string               // Cookie path
  expires?: number            // Expiration timestamp
}

/**
 * Handle browser alert (GPM Automate inspired)
 */
export interface AlertAction extends BaseAction {
  type: 'alert'
  action: 'accept' | 'dismiss' | 'getText' | 'sendText'
  text?: string               // Text to send (for sendText action)
}

/**
 * File read operation (GPM Automate inspired)
 */
export interface FileReadAction extends BaseAction {
  type: 'fileRead'
  path: string                // File path to read
  encoding?: 'utf8' | 'base64' | 'binary'
}

/**
 * File write operation (GPM Automate inspired)
 */
export interface FileWriteAction extends BaseAction {
  type: 'fileWrite'
  path: string                // File path to write
  content: string             // Content to write
  encoding?: 'utf8' | 'base64' | 'binary'
  append?: boolean            // Append to file instead of overwrite
}

/**
 * HTTP request (GPM Automate inspired)
 */
export interface HttpRequestAction extends BaseAction {
  type: 'httpRequest'
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'
  url: string
  headers?: Record<string, string>
  body?: string | object
  timeout?: number
}

/**
 * Image search (GPM Automate inspired - template matching)
 */
export interface ImageSearchAction extends BaseAction {
  type: 'imageSearch'
  templatePath: string        // Path to template image
  threshold?: number          // Match threshold (0-1)
  region?: {                  // Search region (optional)
    x: number
    y: number
    width: number
    height: number
  }
}

/**
 * Switch browser tab (GPM Automate inspired)
 */
export interface SwitchTabAction extends BaseAction {
  type: 'switchTab'
  index?: number              // Tab index (0-based)
  url?: string                // Switch to tab with this URL
  title?: string              // Switch to tab with this title
}

/**
 * Set variable (GPM Automate inspired)
 */
export interface SetVariableAction extends BaseAction {
  type: 'setVariable'
  variableName: string
  value: any
}

/**
 * Get variable (GPM Automate inspired)
 */
export interface GetVariableAction extends BaseAction {
  type: 'getVariable'
  variableName: string
}

/**
 * Union type of all actions
 */
export type Action =
  | NavigateAction
  | ClickAction
  | TypeAction
  | FillAction
  | SelectAction
  | WaitAction
  | WaitForSelectorAction
  | WaitForNavigationAction
  | ScreenshotAction
  | ScrollAction
  | HoverAction
  | KeyboardAction
  | EvaluateAction
  | AssertAction
  | DoubleClickAction
  | RightClickAction
  | DragAction
  // GPM Automate inspired actions
  | ClipboardAction
  | CookieAction
  | AlertAction
  | FileReadAction
  | FileWriteAction
  | HttpRequestAction
  | ImageSearchAction
  | SwitchTabAction
  | SetVariableAction
  | GetVariableAction

/**
 * Recording configuration
 */
export interface RecordingConfig {
  defaultTimeout?: number
  screenshotOnError?: boolean
  retryOnFailure?: boolean
  retryCount?: number
  retryDelay?: number
}

/**
 * Recording metadata
 */
export interface RecordingMetadata {
  name: string
  description?: string
  accountType?: string
  url?: string
  author?: string
  tags?: string[]
  version?: string
  // GPM Automate inspired variables - collected during recording
  profileName?: string      // $profileName - Tên của profile đang mở
  profileId?: string        // $profileId - ID của profile đang mở
  profileProxy?: string     // $profileProxy - Proxy mà profile đang sử dụng
  accountId?: string        // Account ID nếu recording for specific account
  accountLabel?: string     // Account label
  accountIdentifier?: string // Account identifier (email, username, etc.)
}

/**
 * Complete action recording structure
 */
export interface ActionRecording {
  version: string
  metadata: RecordingMetadata
  actions: Action[]
  config?: RecordingConfig
}

/**
 * Replay result
 */
export interface ReplayResult {
  success: boolean
  actionsExecuted: number
  actionsFailed: number
  errors: Array<{
    actionIndex: number
    actionType: ActionType
    error: string
    timestamp?: number
  }>
  durationMs?: number
}

/**
 * Recording run status
 */
export type RecordingRunStatus = 'running' | 'completed' | 'failed' | 'paused' | 'cancelled'

/**
 * Helper function to generate unique action ID
 */
export function generateActionId(): string {
  return `action_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

/**
 * Helper function to validate action
 */
export function validateAction(action: Action): { valid: boolean; error?: string } {
  if (!action.id) {
    return { valid: false, error: 'Action must have an ID' }
  }
  if (!action.type) {
    return { valid: false, error: 'Action must have a type' }
  }
  if (typeof action.timestamp !== 'number') {
    return { valid: false, error: 'Action must have a valid timestamp' }
  }

  // Type-specific validation
  switch (action.type) {
    case 'navigate':
      if (!('url' in action) || !action.url) {
        return { valid: false, error: 'Navigate action must have a URL' }
      }
      break
    case 'click':
    case 'type':
    case 'fill':
    case 'hover':
    case 'doubleClick':
    case 'rightClick':
      if (!action.selector) {
        return { valid: false, error: `${action.type} action must have a selector` }
      }
      break
    case 'type':
      if (!('text' in action) || typeof action.text !== 'string') {
        return { valid: false, error: 'Type action must have text' }
      }
      break
    case 'wait':
      if (!('duration' in action) || typeof action.duration !== 'number') {
        return { valid: false, error: 'Wait action must have a duration' }
      }
      break
  }

  return { valid: true }
}

