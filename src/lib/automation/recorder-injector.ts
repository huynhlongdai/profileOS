/**
 * Improved RecorderInjector with better error handling and retry logic
 */

import CDP from 'chrome-remote-interface'
import { RECORDER_SCRIPT } from './recorder-script'
import { withRetry, safeAction, classifyError } from '@/core/utils/RetryUtils'

export class RecorderInjector {
    /**
     * Inject recorder script into browser with retry logic
     */
    static async inject(
        remoteDebuggingPort: number,
        recordingId: string
    ): Promise<void> {
        return withRetry(
            async () => {
                let client: any = null

                try {
                    console.log('[RecorderInjector] Connecting to CDP on port:', remoteDebuggingPort)

                    // Connect with timeout
                    client = await Promise.race([
                        CDP({ port: remoteDebuggingPort }),
                        new Promise((_, reject) =>
                            setTimeout(() => reject(new Error('CDP connection timeout after 10s')), 10000)
                        )
                    ])

                    if (!client) {
                        throw new Error('Failed to connect to CDP')
                    }

                    console.log('[RecorderInjector] Connected, enabling Runtime domain')
                    await client.Runtime.enable()

                    // Check if recorder is already injected
                    const checkResult = await client.Runtime.evaluate({
                        expression: 'typeof window.__gpmRecorder !== "undefined"',
                        returnByValue: true,
                    })

                    if (checkResult.result.value === true) {
                        console.log('[RecorderInjector] Recorder already exists, reusing')

                        // Just start recording with new ID
                        const startResult = await client.Runtime.evaluate({
                            expression: `window.__gpmRecorder.start('${recordingId}')`,
                            returnByValue: false,
                        })

                        if (startResult.exceptionDetails) {
                            throw new Error(
                                `Failed to start existing recorder: ${JSON.stringify(startResult.exceptionDetails.text || startResult.exceptionDetails)}`
                            )
                        }

                        console.log('[RecorderInjector] Reused existing recorder for:', recordingId)
                        return
                    }

                    // Inject recorder script
                    console.log('[RecorderInjector] Injecting recorder script...')
                    const injectResult = await client.Runtime.evaluate({
                        expression: RECORDER_SCRIPT,
                        returnByValue: false,
                    })

                    if (injectResult.exceptionDetails) {
                        const errorText = injectResult.exceptionDetails.exception?.description ||
                            injectResult.exceptionDetails.text ||
                            JSON.stringify(injectResult.exceptionDetails)
                        throw new Error(`Script injection failed: ${errorText}`)
                    }

                    console.log('[RecorderInjector] Script injected, starting recording:', recordingId)

                    // Verify injection with retry
                    await safeAction(
                        async () => {
                            const verifyResult = await client.Runtime.evaluate({
                                expression: 'typeof window.__gpmRecorder',
                                returnByValue: true,
                            })

                            if (verifyResult.result.value !== 'object') {
                                throw new Error('Recorder not properly injected')
                            }
                        },
                        'verifying recorder injection',
                        null,
                        { maxRetries: 2, initialDelayMs: 500 }
                    )

                    // Start recording
                    const startResult = await client.Runtime.evaluate({
                        expression: `window.__gpmRecorder.start('${recordingId}')`,
                        returnByValue: false,
                    })

                    if (startResult.exceptionDetails) {
                        const errorText = startResult.exceptionDetails.exception?.description ||
                            startResult.exceptionDetails.text ||
                            JSON.stringify(startResult.exceptionDetails)
                        throw new Error(`Failed to start recording: ${errorText}`)
                    }

                    console.log('[RecorderInjector] Recording started successfully:', recordingId)
                } catch (error) {
                    // Classify error and add context
                    const classification = classifyError(error)
                    const errorMsg = error instanceof Error ? error.message : String(error)

                    console.error('[RecorderInjector] Injection failed:', errorMsg)
                    console.error('[RecorderInjector] Error classification:', classification)

                    // Enhance error message for common issues
                    if (errorMsg.includes('ECONNREFUSED')) {
                        throw new Error(
                            `Cannot connect to browser on port ${remoteDebuggingPort}. ` +
                            `Make sure the profile is running and has remote debugging enabled.`
                        )
                    }

                    if (errorMsg.includes('timeout')) {
                        throw new Error(
                            `Browser connection timeout on port ${remoteDebuggingPort}. ` +
                            `The browser may be unresponsive or the port may be incorrect.`
                        )
                    }

                    throw error
                } finally {
                    if (client) {
                        try {
                            await client.close()
                        } catch (e) {
                            console.warn('[RecorderInjector] Failed to close CDP connection:', e)
                        }
                    }
                }
            },
            {
                maxRetries: 2,
                initialDelayMs: 1000,
                onRetry: (attempt, error, delay) => {
                    console.log(
                        `[RecorderInjector] Retry ${attempt} after ${delay}ms due to:`,
                        error instanceof Error ? error.message : String(error)
                    )
                },
            }
        )
    }

    /**
     * Stop recording in browser
     */
    static async stop(remoteDebuggingPort: number): Promise<void> {
        return safeAction(
            async () => {
                const client = await CDP({ port: remoteDebuggingPort })

                try {
                    const result = await client.Runtime.evaluate({
                        expression: 'window.__gpmRecorder && window.__gpmRecorder.stop()',
                        returnByValue: true,
                    })

                    if (result.exceptionDetails) {
                        console.warn('[RecorderInjector] Exception while stopping:', result.exceptionDetails.text)
                    } else {
                        console.log('[RecorderInjector] Stopped recording, actions count:', result.result.value?.length || 0)
                    }
                } finally {
                    await client.close()
                }
            },
            'stopping recorder',
            undefined,
            { maxRetries: 1, initialDelayMs: 500 }
        )
    }

    /**
     * Check if recorder is active
     */
    static async isRecording(remoteDebuggingPort: number): Promise<boolean> {
        return safeAction(
            async () => {
                const client = await CDP({ port: remoteDebuggingPort })

                try {
                    const result = await client.Runtime.evaluate({
                        expression: 'window.__gpmRecorder && window.__gpmRecorder.isRecording',
                        returnByValue: true,
                    })

                    return result.result.value === true
                } finally {
                    await client.close()
                }
            },
            'checking recorder status',
            false,
            { maxRetries: 1, initialDelayMs: 300 }
        )
    }

    /**
     * Get current action count
     */
    static async getActionCount(remoteDebuggingPort: number): Promise<number> {
        return safeAction(
            async () => {
                const client = await CDP({ port: remoteDebuggingPort })

                try {
                    const result = await client.Runtime.evaluate({
                        expression: 'window.__gpmRecorder && window.__gpmRecorder.actions.length',
                        returnByValue: true,
                    })

                    return result.result.value || 0
                } finally {
                    await client.close()
                }
            },
            'getting action count',
            0,
            { maxRetries: 1, initialDelayMs: 300 }
        )
    }
}
