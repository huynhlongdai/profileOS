// Automation Types

export type ActionType =
    // Basic actions (current)
    | 'click'
    | 'input'
    | 'navigate'
    | 'scroll'
    | 'select'
    | 'wait'
    | 'screenshot'
    | 'keypress'
    // Tier 1: Mouse operations
    | 'hover'
    | 'rightClick'
    | 'doubleClick'
    | 'dragAndDrop'
    // Tier 1: Element checks
    | 'waitElement'
    | 'checkElement'
    | 'getElementText'
    | 'getElementAttribute'
    // Tier 2: Variables
    | 'setVariable'
    | 'getVariable'
    | 'incrementVariable'
    | 'decrementVariable'
    // Tier 2: Clipboard
    | 'getClipboard'
    | 'setClipboard'

export interface RecordedAction {
    id: string
    type: ActionType
    timestamp: number

    // Element identification
    selector?: string
    xpath?: string
    text?: string // For text-based finding

    // Action data
    value?: string | number | boolean
    coordinates?: { x: number; y: number }
    key?: string // For keypress actions

    // Extended properties for new actions
    timeout?: number // For waitElement
    condition?: 'exists' | 'visible' | 'hidden' | 'enabled' | 'hasText' // For checkElement and waitElement
    expectedValue?: string // For checkElement
    variableName?: string // For getElement* actions
    attribute?: string // For getElementAttribute
    fromCoordinates?: { x: number; y: number } // For dragAndDrop
    toCoordinates?: { x: number; y: number } // For dragAndDrop

    // Context
    url: string
    title: string
    screenshot?: string // Base64 or URL

    // Metadata
    metadata?: {
        tagName?: string
        attributes?: Record<string, string>
        innerText?: string
        viewport?: { width: number; height: number }
    }
}

export interface TemplateVariable {
    name: string
    type: 'string' | 'number' | 'boolean' | 'file' | 'select'
    label: string
    description?: string
    required?: boolean
    defaultValue?: any
    options?: Array<{ label: string; value: any }> // For select type
    validation?: {
        pattern?: string
        min?: number
        max?: number
        minLength?: number
        maxLength?: number
    }
}

export interface AutomationBlock {
    id: string
    type: 'action' | 'control' | 'data' | 'ai'
    category: string // 'navigation' | 'element' | 'loop' | etc.
    name: string
    config: Record<string, any>
    next?: string // ID of next block
    branches?: Record<string, string> // For conditional blocks
}

export interface ExecutionLog {
    timestamp: number
    level: 'info' | 'warning' | 'error'
    message: string
    data?: any
}

export interface ExecutionResult {
    success: boolean
    data?: any
    error?: string
    logs: ExecutionLog[]
    stats: {
        totalActions: number
        successfulActions: number
        failedActions: number
        duration: number
    }
}
