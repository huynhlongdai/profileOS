/**
 * RetryUtils - Utility functions for retry logic with exponential backoff
 * 
 * Provides robust error handling for browser automation and API calls.
 */

export interface RetryOptions {
    /** Maximum number of retry attempts */
    maxRetries?: number
    /** Initial delay in milliseconds before first retry */
    initialDelayMs?: number
    /** Maximum delay in milliseconds between retries */
    maxDelayMs?: number
    /** Backoff multiplier (default: 2 for exponential) */
    backoffMultiplier?: number
    /** Custom function to determine if error is retryable */
    isRetryable?: (error: unknown) => boolean
    /** Callback fired before each retry attempt */
    onRetry?: (attempt: number, error: unknown, nextDelayMs: number) => void
}

const DEFAULT_OPTIONS: Required<RetryOptions> = {
    maxRetries: 3,
    initialDelayMs: 1000,
    maxDelayMs: 30000,
    backoffMultiplier: 2,
    isRetryable: () => true,
    onRetry: () => { },
}

/**
 * Classify errors for retry decision
 */
export enum ErrorClassification {
    /** Error is retryable - try again */
    RETRYABLE = 'retryable',
    /** Error is not retryable - fail immediately */
    NON_RETRYABLE = 'non_retryable',
    /** Skip this operation and continue with next */
    SKIP = 'skip',
}

/**
 * Common error patterns and their classifications
 */
const ERROR_PATTERNS: Array<{ pattern: RegExp; classification: ErrorClassification }> = [
    // Network errors - retryable
    { pattern: /ECONNRESET|ETIMEDOUT|ENOTFOUND|ECONNREFUSED/i, classification: ErrorClassification.RETRYABLE },
    { pattern: /network|connection|timeout|fetch/i, classification: ErrorClassification.RETRYABLE },
    { pattern: /socket hang up/i, classification: ErrorClassification.RETRYABLE },

    // Browser/page errors - usually retryable
    { pattern: /page crash|context closed|browser has been closed/i, classification: ErrorClassification.RETRYABLE },
    { pattern: /target closed|session closed/i, classification: ErrorClassification.RETRYABLE },
    { pattern: /waiting for selector/i, classification: ErrorClassification.RETRYABLE },

    // Rate limiting - retryable with longer delay
    { pattern: /rate limit|too many requests|429/i, classification: ErrorClassification.RETRYABLE },

    // Authentication errors - non-retryable
    { pattern: /2FA required|manual intervention/i, classification: ErrorClassification.NON_RETRYABLE },
    { pattern: /invalid password|wrong password/i, classification: ErrorClassification.NON_RETRYABLE },
    { pattern: /account suspended|account disabled/i, classification: ErrorClassification.NON_RETRYABLE },

    // Gmail specific - skip and continue
    { pattern: /no emails found|empty inbox/i, classification: ErrorClassification.SKIP },
    { pattern: /element not found|no such element/i, classification: ErrorClassification.SKIP },
]

/**
 * Classify an error for retry decision
 */
export function classifyError(error: unknown): ErrorClassification {
    const errorMessage = error instanceof Error ? error.message : String(error)

    for (const { pattern, classification } of ERROR_PATTERNS) {
        if (pattern.test(errorMessage)) {
            return classification
        }
    }

    // Default: retryable for unknown errors
    return ErrorClassification.RETRYABLE
}

/**
 * Calculate delay with exponential backoff and jitter
 */
function calculateDelay(
    attempt: number,
    initialDelayMs: number,
    maxDelayMs: number,
    multiplier: number
): number {
    // Exponential backoff: initialDelay * multiplier^attempt
    const exponentialDelay = initialDelayMs * Math.pow(multiplier, attempt)

    // Cap at maxDelay
    const cappedDelay = Math.min(exponentialDelay, maxDelayMs)

    // Add jitter (±20%) to prevent thundering herd
    const jitter = cappedDelay * (0.8 + Math.random() * 0.4)

    return Math.floor(jitter)
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Retry a function with exponential backoff
 * 
 * @example
 * ```typescript
 * const result = await withRetry(
 *   () => fetchData(),
 *   { maxRetries: 3, initialDelayMs: 1000 }
 * )
 * ```
 */
export async function withRetry<T>(
    fn: () => Promise<T>,
    options: RetryOptions = {}
): Promise<T> {
    const opts = { ...DEFAULT_OPTIONS, ...options }

    let lastError: unknown

    for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
        try {
            return await fn()
        } catch (error) {
            lastError = error

            // Check if we should retry
            if (attempt >= opts.maxRetries) {
                throw error
            }

            // Check if error is retryable
            const classification = classifyError(error)
            if (classification === ErrorClassification.NON_RETRYABLE) {
                throw error
            }
            if (classification === ErrorClassification.SKIP) {
                // Return undefined for skip errors
                throw error
            }

            // Check custom isRetryable
            if (!opts.isRetryable(error)) {
                throw error
            }

            // Calculate delay for next retry
            const delay = calculateDelay(
                attempt,
                opts.initialDelayMs,
                opts.maxDelayMs,
                opts.backoffMultiplier
            )

            // Fire onRetry callback
            opts.onRetry(attempt + 1, error, delay)

            // Wait before retrying
            await sleep(delay)
        }
    }

    throw lastError
}

/**
 * Create a retryable version of a function
 * 
 * @example
 * ```typescript
 * const retryableFetch = createRetryableFunction(
 *   fetchData,
 *   { maxRetries: 3 }
 * )
 * const result = await retryableFetch()
 * ```
 */
export function createRetryableFunction<TArgs extends unknown[], TResult>(
    fn: (...args: TArgs) => Promise<TResult>,
    options: RetryOptions = {}
): (...args: TArgs) => Promise<TResult> {
    return (...args: TArgs) => withRetry(() => fn(...args), options)
}

/**
 * Retry decorator for class methods
 * 
 * @example
 * ```typescript
 * class MyService {
 *   @Retryable({ maxRetries: 3 })
 *   async fetchData() {
 *     // ...
 *   }
 * }
 * ```
 */
export function Retryable(options: RetryOptions = {}) {
    return function (
        _target: unknown,
        _propertyKey: string,
        descriptor: PropertyDescriptor
    ) {
        const originalMethod = descriptor.value

        descriptor.value = async function (...args: unknown[]) {
            return withRetry(() => originalMethod.apply(this, args), options)
        }

        return descriptor
    }
}

/**
 * Safe action wrapper - execute action with retry or return default value
 * 
 * @example
 * ```typescript
 * const result = await safeAction(
 *   () => riskOperation(),
 *   'doing risky thing',
 *   defaultValue,
 *   { maxRetries: 2 }
 * )
 * ```
 */
export async function safeAction<T>(
    fn: () => Promise<T>,
    actionName: string,
    defaultValue: T,
    options: RetryOptions = {}
): Promise<T> {
    try {
        return await withRetry(fn, {
            ...options,
            onRetry: (attempt, error, delay) => {
                console.warn(
                    `[Retry] ${actionName} failed (attempt ${attempt}), retrying in ${delay}ms:`,
                    error instanceof Error ? error.message : String(error)
                )
                options.onRetry?.(attempt, error, delay)
            },
        })
    } catch (error) {
        const classification = classifyError(error)

        if (classification === ErrorClassification.SKIP) {
            console.log(`[SafeAction] Skipping ${actionName}: ${error instanceof Error ? error.message : String(error)}`)
            return defaultValue
        }

        console.error(`[SafeAction] ${actionName} failed after retries:`, error)
        return defaultValue
    }
}

/**
 * Batch retry - retry multiple items, collecting successes and failures
 * 
 * @example
 * ```typescript
 * const results = await batchRetry(
 *   items,
 *   async (item) => processItem(item),
 *   { maxRetries: 2, concurrency: 3 }
 * )
 * console.log(`Success: ${results.successes.length}, Failed: ${results.failures.length}`)
 * ```
 */
export interface BatchRetryOptions extends RetryOptions {
    /** Maximum concurrent operations */
    concurrency?: number
    /** Continue processing even if some items fail */
    continueOnError?: boolean
}

export interface BatchRetryResult<T, R> {
    successes: Array<{ item: T; result: R }>
    failures: Array<{ item: T; error: unknown }>
}

export async function batchRetry<T, R>(
    items: T[],
    fn: (item: T) => Promise<R>,
    options: BatchRetryOptions = {}
): Promise<BatchRetryResult<T, R>> {
    const {
        concurrency = 3,
        continueOnError = true,
        ...retryOptions
    } = options

    const successes: Array<{ item: T; result: R }> = []
    const failures: Array<{ item: T; error: unknown }> = []

    // Process in batches
    for (let i = 0; i < items.length; i += concurrency) {
        const batch = items.slice(i, i + concurrency)

        const batchPromises = batch.map(async (item) => {
            try {
                const result = await withRetry(() => fn(item), retryOptions)
                successes.push({ item, result })
            } catch (error) {
                failures.push({ item, error })
                if (!continueOnError) {
                    throw error
                }
            }
        })

        if (continueOnError) {
            await Promise.allSettled(batchPromises)
        } else {
            await Promise.all(batchPromises)
        }
    }

    return { successes, failures }
}
