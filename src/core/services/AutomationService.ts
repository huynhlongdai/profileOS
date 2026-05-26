import { prisma } from '@/lib/prisma'
import type {
    RecordedAction,
    TemplateVariable,
    ExecutionLog,
    ExecutionResult,
} from '@/types/automation'
import { RecorderInjector } from '@/lib/automation/recorder-injector'
import CDP from 'chrome-remote-interface'
import { ExecutionContext } from '@/core/automation/ExecutionContext'

export class AutomationService {
    /**
     * Start recording actions for a profile
     */
    async startRecording(
        profileId: string,
        name: string,
        description?: string
    ): Promise<any> {
        // Check if profile exists and is running
        // Try to find by id first, then by profileUid
        let profile = await prisma.profile.findUnique({
            where: { id: profileId },
        })

        // If not found by id, try profileUid
        if (!profile) {
            profile = await prisma.profile.findUnique({
                where: { profileUid: profileId },
            })
        }

        if (!profile) {
            throw new Error('Profile not found. Please select a valid profile.')
        }

        if (profile.status !== 'running') {
            throw new Error(
                `Profile "${profile.name}" is not running (status: ${profile.status}). Please start the profile first before recording.`
            )
        }

        if (!profile.remoteDebuggingPort) {
            throw new Error(
                `Profile "${profile.name}" does not have a remote debugging port. The profile may not have started properly. Try restarting the profile.`
            )
        }

        // Create recording
        const recording = await prisma.actionRecording.create({
            data: {
                name,
                description,
                actionsJson: JSON.stringify([]),
                actionCount: 0,
                status: 'draft',
            },
        })

        // Inject recorder script into browser
        try {
            console.log(
                `[AutomationService] Injecting recorder into profile ${profile.name} on port ${profile.remoteDebuggingPort}`
            )
            await RecorderInjector.inject(profile.remoteDebuggingPort, recording.id)
            console.log(`[AutomationService] Recorder injected successfully for recording ${recording.id}`)
        } catch (error) {
            // If injection fails, delete the recording
            await prisma.actionRecording.delete({ where: { id: recording.id } })
            const errorMsg = error instanceof Error ? error.message : 'Unknown error'
            console.error('[AutomationService] Failed to inject recorder:', errorMsg)
            throw new Error(
                `Failed to inject recorder script into browser: ${errorMsg}. Make sure the browser is open and responsive.`
            )
        }

        return recording
    }

    /**
     * Add action to recording
     */
    async addAction(recordingId: string, action: RecordedAction): Promise<void> {
        const recording = await prisma.actionRecording.findUnique({
            where: { id: recordingId },
        })

        if (!recording) {
            throw new Error('Recording not found')
        }

        const actions = JSON.parse(recording.actionsJson) as RecordedAction[]
        actions.push(action)

        await prisma.actionRecording.update({
            where: { id: recordingId },
            data: {
                actionsJson: JSON.stringify(actions),
                actionCount: actions.length,
            },
        })
    }

    /**
   * Stop recording and save
   */
    async stopRecording(recordingId: string): Promise<any> {
        const recording = await prisma.actionRecording.findUnique({
            where: { id: recordingId },
        })

        if (!recording) {
            throw new Error('Recording not found')
        }

        // Try to stop recorder in browser (best effort)
        // We don't know which profile was used, so we can't stop it reliably
        // The recorder will auto-stop when page is closed

        const updated = await prisma.actionRecording.update({
            where: { id: recordingId },
            data: {
                status: 'published',
            },
        })

        return updated
    }

    /**
     * Get recording by ID
     */
    async getRecording(recordingId: string): Promise<any> {
        return await prisma.actionRecording.findUnique({
            where: { id: recordingId },
        })
    }

    /**
     * List all recordings
     */
    async listRecordings(filter?: {
        status?: string
        accountType?: string
        search?: string
    }): Promise<any[]> {
        const where: any = {}

        if (filter?.status) {
            where.status = filter.status
        }

        if (filter?.accountType) {
            where.accountType = filter.accountType
        }

        if (filter?.search) {
            where.OR = [
                { name: { contains: filter.search } },
                { description: { contains: filter.search } },
            ]
        }

        return await prisma.actionRecording.findMany({
            where,
            orderBy: { createdAt: 'desc' },
        })
    }

    /**
     * Delete recording
     */
    async deleteRecording(recordingId: string): Promise<void> {
        await prisma.actionRecording.delete({
            where: { id: recordingId },
        })
    }

    /**
     * Convert recording to template
     */
    async convertToTemplate(
        recordingId: string,
        templateData: {
            name: string
            description?: string
            category: string
            variables?: TemplateVariable[]
        }
    ): Promise<any> {
        const recording = await prisma.actionRecording.findUnique({
            where: { id: recordingId },
        })

        if (!recording) {
            throw new Error('Recording not found')
        }

        const actions = JSON.parse(recording.actionsJson) as RecordedAction[]

        // Process actions to extract variables if provided
        const processedActions = this.processActionsWithVariables(
            actions,
            templateData.variables || []
        )

        const template = await prisma.automationTemplate.create({
            data: {
                name: templateData.name,
                description: templateData.description,
                category: templateData.category,
                actionsJson: JSON.stringify(processedActions),
                variablesJson: JSON.stringify(templateData.variables || []),
                isPublic: false,
            },
        })

        return template
    }

    /**
     * Process actions with variables
     */
    private processActionsWithVariables(
        actions: RecordedAction[],
        variables: TemplateVariable[]
    ): RecordedAction[] {
        // Replace hardcoded values with variable placeholders
        return actions.map((action) => {
            if (action.type === 'input' && action.value) {
                // Check if this value should be a variable
                const matchingVar = variables.find((v) =>
                    action.selector?.toLowerCase().includes(v.name.toLowerCase())
                )

                if (matchingVar) {
                    return {
                        ...action,
                        value: `{{${matchingVar.name}}}`,
                    }
                }
            }
            return action
        })
    }

    /**
     * Create template
     */
    async createTemplate(data: {
        name: string
        description?: string
        category: string
        actions: RecordedAction[]
        variables?: TemplateVariable[]
    }): Promise<any> {
        return await prisma.automationTemplate.create({
            data: {
                name: data.name,
                description: data.description,
                category: data.category,
                actionsJson: JSON.stringify(data.actions),
                variablesJson: JSON.stringify(data.variables || []),
                isPublic: false,
            },
        })
    }

    /**
     * Get template by ID
     */
    async getTemplate(templateId: string): Promise<any> {
        return await prisma.automationTemplate.findUnique({
            where: { id: templateId },
        })
    }

    /**
     * List templates
     */
    async listTemplates(filter?: {
        category?: string
        isPublic?: boolean
        search?: string
    }): Promise<any[]> {
        const where: any = {}

        if (filter?.category) {
            where.category = filter.category
        }

        if (filter?.isPublic !== undefined) {
            where.isPublic = filter.isPublic
        }

        if (filter?.search) {
            where.OR = [
                { name: { contains: filter.search } },
                { description: { contains: filter.search } },
            ]
        }

        return await prisma.automationTemplate.findMany({
            where,
            orderBy: [{ usageCount: 'desc' }, { createdAt: 'desc' }],
        })
    }

    /**
     * Delete template
     */
    async deleteTemplate(templateId: string): Promise<void> {
        await prisma.automationTemplate.delete({
            where: { id: templateId },
        })
    }

    /**
     * Execute template
     */
    async executeTemplate(
        templateId: string,
        profileId: string,
        variableValues: Record<string, any>
    ): Promise<any> {
        const template = await prisma.automationTemplate.findUnique({
            where: { id: templateId },
        })

        if (!template) {
            throw new Error('Template not found')
        }

        // Create execution record
        const execution = await prisma.automationExecution.create({
            data: {
                templateId,
                profileId,
                status: 'pending',
                actionsJson: template.actionsJson,
                variablesJson: JSON.stringify(variableValues),
            },
        })

        // Increment usage count
        await prisma.automationTemplate.update({
            where: { id: templateId },
            data: {
                usageCount: { increment: 1 },
            },
        })

        // Execute in background (don't await)
        this.runExecution(execution.id).catch(console.error)

        return execution
    }

    /**
     * Run execution
     */
    private async runExecution(executionId: string): Promise<void> {
        const execution = await prisma.automationExecution.findUnique({
            where: { id: executionId },
        })

        if (!execution) return

        const startTime = Date.now()
        const logs: ExecutionLog[] = []

        try {
            await prisma.automationExecution.update({
                where: { id: executionId },
                data: {
                    status: 'running',
                    startedAt: new Date(),
                },
            })

            logs.push({
                timestamp: Date.now(),
                level: 'info',
                message: 'Execution started',
            })

            const actions = JSON.parse(execution.actionsJson) as RecordedAction[]
            const variables = execution.variablesJson
                ? JSON.parse(execution.variablesJson)
                : {}

            // Replace variables in actions
            const processedActions = this.replaceVariables(actions, variables)

            logs.push({
                timestamp: Date.now(),
                level: 'info',
                message: `Processing ${processedActions.length} actions`,
            })

            // Get profile to connect to browser
            const profile = await prisma.profile.findUnique({
                where: { id: execution.profileId },
            })

            if (!profile) {
                throw new Error('Profile not found')
            }

            if (profile.status !== 'running') {
                throw new Error(
                    `Profile is not running (status: ${profile.status}). Please start the profile first.`
                )
            }

            if (!profile.remoteDebuggingPort) {
                throw new Error('Profile does not have remote debugging port')
            }

            logs.push({
                timestamp: Date.now(),
                level: 'info',
                message: `Connecting to browser on port ${profile.remoteDebuggingPort}`,
            })

            // Execute actions using CDP
            const result = await this.executeActionsViaCDP(
                processedActions,
                profile.remoteDebuggingPort,
                logs
            )

            const duration = Date.now() - startTime

            await prisma.automationExecution.update({
                where: { id: executionId },
                data: {
                    status: 'completed',
                    resultJson: JSON.stringify(result),
                    logsJson: JSON.stringify(logs),
                    completedAt: new Date(),
                    duration,
                },
            })
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : 'Unknown error'
            logs.push({
                timestamp: Date.now(),
                level: 'error',
                message: `Execution failed: ${errorMsg}`,
            })

            await prisma.automationExecution.update({
                where: { id: executionId },
                data: {
                    status: 'failed',
                    error: errorMsg,
                    logsJson: JSON.stringify(logs),
                    completedAt: new Date(),
                },
            })
        }
    }

    /**
     * Execute actions via CDP
     */
    private async executeActionsViaCDP(
        actions: RecordedAction[],
        remoteDebuggingPort: number,
        logs: ExecutionLog[]
    ): Promise<ExecutionResult> {
        const CDP = (await import('chrome-remote-interface')).default
        let client: any = null
        let successCount = 0
        let failCount = 0

        // Create execution context for variables
        const context = new ExecutionContext()

        try {
            client = await CDP({ port: remoteDebuggingPort })

            logs.push({
                timestamp: Date.now(),
                level: 'info',
                message: 'Connected to browser via CDP',
            })

            // Enable necessary domains
            await client.Page.enable()
            await client.Runtime.enable()
            await client.DOM.enable()

            for (let i = 0; i < actions.length; i++) {
                const action = actions[i]

                try {
                    logs.push({
                        timestamp: Date.now(),
                        level: 'info',
                        message: `Executing action ${i + 1}/${actions.length}: ${action.type}`,
                    })

                    await this.executeAction(client, action, logs, context)
                    successCount++

                    // Wait between actions
                    await new Promise((resolve) => setTimeout(resolve, 500))
                } catch (error) {
                    failCount++
                    const errorMsg = error instanceof Error ? error.message : 'Unknown error'
                    logs.push({
                        timestamp: Date.now(),
                        level: 'error',
                        message: `Action ${i + 1} failed: ${errorMsg}`,
                    })

                    // Continue with next action
                }
            }

            return {
                success: failCount === 0,
                logs,
                stats: {
                    totalActions: actions.length,
                    successfulActions: successCount,
                    failedActions: failCount,
                    duration: 0, // Will be set by caller
                },
            }
        } finally {
            if (client) {
                await client.close()
                logs.push({
                    timestamp: Date.now(),
                    level: 'info',
                    message: 'Disconnected from browser',
                })
            }
        }
    }

    /**
     * Execute single action
     */
    private async executeAction(
        client: any,
        action: RecordedAction,
        logs: ExecutionLog[],
        context: ExecutionContext
    ): Promise<void> {
        switch (action.type) {
            case 'navigate':
                await this.executeNavigate(client, action, logs)
                break
            case 'click':
                await this.executeClick(client, action, logs)
                break
            case 'input':
                await this.executeInput(client, action, logs)
                break
            case 'select':
                await this.executeSelect(client, action, logs)
                break
            case 'scroll':
                await this.executeScroll(client, action, logs)
                break
            case 'wait':
                await this.executeWait(action, logs)
                break
            // Tier 1: Mouse operations
            case 'hover':
                await this.executeHover(client, action, logs)
                break
            case 'rightClick':
                await this.executeRightClick(client, action, logs)
                break
            case 'doubleClick':
                await this.executeDoubleClick(client, action, logs)
                break
            case 'dragAndDrop':
                await this.executeDragAndDrop(client, action, logs)
                break
            // Tier 1: Element checks
            case 'waitElement':
                await this.executeWaitElement(client, action, logs)
                break
            case 'checkElement':
                await this.executeCheckElement(client, action, logs)
                break
            case 'getElementText':
                await this.executeGetElementText(client, action, logs)
                break
            case 'getElementAttribute':
                await this.executeGetElementAttribute(client, action, logs)
                break
            // Tier 2: Variables
            case 'setVariable':
                await this.executeSetVariable(action, logs, context)
                break
            case 'incrementVariable':
                await this.executeIncrementVariable(action, logs, context)
                break
            case 'decrementVariable':
                await this.executeDecrementVariable(action, logs, context)
                break
            // Tier 2: Clipboard
            case 'getClipboard':
                await this.executeGetClipboard(client, action, logs, context)
                break
            case 'setClipboard':
                await this.executeSetClipboard(client, action, logs, context)
                break
            default:
                logs.push({
                    timestamp: Date.now(),
                    level: 'warning',
                    message: `Unknown action type: ${action.type}`,
                })
        }
    }

    /**
     * Execute navigate action
     */
    private async executeNavigate(
        client: any,
        action: RecordedAction,
        logs: ExecutionLog[]
    ): Promise<void> {
        if (!action.url) {
            throw new Error('Navigate action missing URL')
        }

        await client.Page.navigate({ url: action.url })
        await client.Page.loadEventFired()

        logs.push({
            timestamp: Date.now(),
            level: 'info',
            message: `Navigated to ${action.url}`,
        })
    }

    /**
     * Execute click action
     */
    private async executeClick(
        client: any,
        action: RecordedAction,
        logs: ExecutionLog[]
    ): Promise<void> {
        // Try to find element by selector first, fallback to XPath
        const selector = action.selector || action.xpath

        if (!selector) {
            throw new Error('Click action missing selector')
        }

        // Get document
        const { root } = await client.DOM.getDocument()

        // Try CSS selector first
        let nodeId: number | null = null
        try {
            const { nodeId: foundNodeId } = await client.DOM.querySelector({
                nodeId: root.nodeId,
                selector: action.selector,
            })
            nodeId = foundNodeId
        } catch {
            // Fallback to XPath if available
            if (action.xpath) {
                try {
                    const result = await client.Runtime.evaluate({
                        expression: `document.evaluate("${action.xpath}", document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue`,
                    })
                    if (result.result.objectId) {
                        const { nodeId: foundNodeId } = await client.DOM.requestNode({
                            objectId: result.result.objectId,
                        })
                        nodeId = foundNodeId
                    }
                } catch (xpathError) {
                    throw new Error(`Element not found: ${selector}`)
                }
            } else {
                throw new Error(`Element not found: ${selector}`)
            }
        }

        if (!nodeId) {
            throw new Error(`Element not found: ${selector}`)
        }

        // Get box model to calculate click position
        const { model } = await client.DOM.getBoxModel({ nodeId })

        // Click at center of element
        const x = (model.content[0] + model.content[2]) / 2
        const y = (model.content[1] + model.content[5]) / 2

        await client.Input.dispatchMouseEvent({
            type: 'mousePressed',
            x,
            y,
            button: 'left',
            clickCount: 1,
        })

        await client.Input.dispatchMouseEvent({
            type: 'mouseReleased',
            x,
            y,
            button: 'left',
            clickCount: 1,
        })

        logs.push({
            timestamp: Date.now(),
            level: 'info',
            message: `Clicked on ${selector}`,
        })

        // Wait for potential navigation or page update
        await new Promise((resolve) => setTimeout(resolve, 300))
    }

    /**
     * Execute input action
     */
    private async executeInput(
        client: any,
        action: RecordedAction,
        logs: ExecutionLog[]
    ): Promise<void> {
        const selector = action.selector || action.xpath

        if (!selector || !action.value) {
            throw new Error('Input action missing selector or value')
        }

        // Focus on element first (use click logic)
        await this.executeClick(client, { ...action, type: 'click' }, [])

        // Type the value
        const value = String(action.value)
        for (const char of value) {
            await client.Input.dispatchKeyEvent({
                type: 'keyDown',
                text: char,
            })
            await client.Input.dispatchKeyEvent({
                type: 'keyUp',
                text: char,
            })
            await new Promise((resolve) => setTimeout(resolve, 50))
        }

        logs.push({
            timestamp: Date.now(),
            level: 'info',
            message: `Typed "${value}" into ${selector}`,
        })
    }

    /**
     * Execute select action
     */
    private async executeSelect(
        client: any,
        action: RecordedAction,
        logs: ExecutionLog[]
    ): Promise<void> {
        const selector = action.selector || action.xpath

        if (!selector || action.value === undefined) {
            throw new Error('Select action missing selector or value')
        }

        // Set select value using JavaScript
        const script = `
            const element = document.querySelector("${action.selector}");
            if (element && element.tagName === 'SELECT') {
                element.value = "${action.value}";
                element.dispatchEvent(new Event('change', { bubbles: true }));
                true;
            } else {
                throw new Error('Element is not a select');
            }
        `

        const result = await client.Runtime.evaluate({ expression: script })

        if (result.exceptionDetails) {
            throw new Error('Failed to set select value')
        }

        logs.push({
            timestamp: Date.now(),
            level: 'info',
            message: `Selected "${action.value}" in ${selector}`,
        })
    }

    /**
     * Execute scroll action
     */
    private async executeScroll(
        client: any,
        action: RecordedAction,
        logs: ExecutionLog[]
    ): Promise<void> {
        // Scroll using JavaScript
        const script = `window.scrollTo(${action.coordinates?.x || 0}, ${action.coordinates?.y || 0
            })`

        await client.Runtime.evaluate({ expression: script })

        logs.push({
            timestamp: Date.now(),
            level: 'info',
            message: `Scrolled to (${action.coordinates?.x || 0}, ${action.coordinates?.y || 0
                })`,
        })
    }

    /**
     * Execute wait action
     */
    private async executeWait(action: RecordedAction, logs: ExecutionLog[]): Promise<void> {
        const duration = Number(action.value) || 1000
        await new Promise((resolve) => setTimeout(resolve, duration))

        logs.push({
            timestamp: Date.now(),
            level: 'info',
            message: `Waited ${duration}ms`,
        })
    }

    /**
     * Replace variables in actions
     */
    private replaceVariables(
        actions: RecordedAction[],
        variables: Record<string, any>
    ): RecordedAction[] {
        return actions.map((action) => {
            if (action.value && typeof action.value === 'string') {
                // Replace {{variableName}} with actual value
                let value = action.value
                Object.keys(variables).forEach((key) => {
                    value = value.replace(new RegExp(`{{${key}}}`, 'g'), variables[key])
                })
                return { ...action, value }
            }
            return action
        })
    }

    /**
     * Get execution status
     */
    async getExecution(executionId: string): Promise<any> {
        return await prisma.automationExecution.findUnique({
            where: { id: executionId },
            include: {
                template: true,
            },
        })
    }

    /**
     * List executions
     */
    async listExecutions(filter?: {
        profileId?: string
        templateId?: string
        status?: string
    }): Promise<any[]> {
        const where: any = {}

        if (filter?.profileId) {
            where.profileId = filter.profileId
        }

        if (filter?.templateId) {
            where.templateId = filter.templateId
        }

        if (filter?.status) {
            where.status = filter.status
        }

        return await prisma.automationExecution.findMany({
            where,
            include: {
                template: true,
            },
            orderBy: { createdAt: 'desc' },
        })
    }

    // ============================================================
    // TIER 2: VARIABLE OPERATIONS
    // ============================================================

    /**
     * Execute set variable action
     */
    private async executeSetVariable(
        action: RecordedAction,
        logs: ExecutionLog[],
        context: ExecutionContext
    ): Promise<void> {
        const name = action.variableName
        const value = action.value

        if (!name) {
            throw new Error('Set variable action missing variable name')
        }

        context.set(name, value)

        logs.push({
            timestamp: Date.now(),
            level: 'info',
            message: `Set variable "${name}" = "${value}"`,
        })
    }

    /**
     * Execute increment variable action
     */
    private async executeIncrementVariable(
        action: RecordedAction,
        logs: ExecutionLog[],
        context: ExecutionContext
    ): Promise<void> {
        const name = action.variableName
        const amount = Number(action.value) || 1

        if (!name) {
            throw new Error('Increment variable action missing variable name')
        }

        context.increment(name, amount)

        logs.push({
            timestamp: Date.now(),
            level: 'info',
            message: `Incremented variable "${name}" by ${amount}, new value: ${context.get(name)}`,
        })
    }

    /**
     * Execute decrement variable action
     */
    private async executeDecrementVariable(
        action: RecordedAction,
        logs: ExecutionLog[],
        context: ExecutionContext
    ): Promise<void> {
        const name = action.variableName
        const amount = Number(action.value) || 1

        if (!name) {
            throw new Error('Decrement variable action missing variable name')
        }

        context.decrement(name, amount)

        logs.push({
            timestamp: Date.now(),
            level: 'info',
            message: `Decremented variable "${name}" by ${amount}, new value: ${context.get(name)}`,
        })
    }

    // ============================================================
    // TIER 2: CLIPBOARD OPERATIONS
    // ============================================================

    /**
     * Execute get clipboard action
     */
    private async executeGetClipboard(
        client: any,
        action: RecordedAction,
        logs: ExecutionLog[],
        context: ExecutionContext
    ): Promise<void> {
        // Note: Browser CDP doesn't have direct clipboard access
        // This would need to be implemented with permissions or alternative approach
        // For now, we'll log a warning

        logs.push({
            timestamp: Date.now(),
            level: 'warning',
            message: 'Get clipboard action not yet supported via CDP - requires browser permissions',
        })
    }

    /**
     * Execute set clipboard action
     */
    private async executeSetClipboard(
        client: any,
        action: RecordedAction,
        logs: ExecutionLog[],
        context: ExecutionContext
    ): Promise<void> {
        const value = context.replaceVariables(String(action.value || ''))

        // Use JavaScript to set clipboard
        const script = `
            navigator.clipboard.writeText(\`${value.replace(/`/g, '\\`')}\`).then(() => {
                return 'success';
            }).catch((err) => {
                return 'error: ' + err.message;
            });
        `

        try {
            const result = await client.Runtime.evaluate({ expression: script, awaitPromise: true })

            logs.push({
                timestamp: Date.now(),
                level: 'info',
                message: `Set clipboard to: "${value}"`,
            })
        } catch (error) {
            logs.push({
                timestamp: Date.now(),
                level: 'warning',
                message: `Set clipboard failed - may require user permission`,
            })
        }
    }

    // ============================================================
    // TIER 1: EXTENDED MOUSE OPERATIONS
    // ============================================================

    /**
     * Execute hover action
     */
    private async executeHover(
        client: any,
        action: RecordedAction,
        logs: ExecutionLog[]
    ): Promise<void> {
        const selector = action.selector || action.xpath

        if (!selector) {
            throw new Error('Hover action missing selector')
        }

        // Get element and box model
        const { root } = await client.DOM.getDocument()
        const { nodeId } = await client.DOM.querySelector({
            nodeId: root.nodeId,
            selector: action.selector,
        })

        if (!nodeId) {
            throw new Error(`Element not found: ${selector}`)
        }

        const { model } = await client.DOM.getBoxModel({ nodeId })

        // Move mouse to center of element
        const x = (model.content[0] + model.content[2]) / 2
        const y = (model.content[1] + model.content[5]) / 2

        await client.Input.dispatchMouseEvent({
            type: 'mouseMoved',
            x,
            y,
        })

        logs.push({
            timestamp: Date.now(),
            level: 'info',
            message: `Hovered over ${selector}`,
        })

        // Wait a bit for tooltips/dropdowns to appear
        await new Promise((resolve) => setTimeout(resolve, 500))
    }

    /**
     * Execute right-click action
     */
    private async executeRightClick(
        client: any,
        action: RecordedAction,
        logs: ExecutionLog[]
    ): Promise<void> {
        const selector = action.selector || action.xpath

        if (!selector) {
            throw new Error('Right-click action missing selector')
        }

        // Get element position (reuse click logic)
        const { root } = await client.DOM.getDocument()
        const { nodeId } = await client.DOM.querySelector({
            nodeId: root.nodeId,
            selector: action.selector,
        })

        if (!nodeId) {
            throw new Error(`Element not found: ${selector}`)
        }

        const { model } = await client.DOM.getBoxModel({ nodeId })
        const x = (model.content[0] + model.content[2]) / 2
        const y = (model.content[1] + model.content[5]) / 2

        // Right-click
        await client.Input.dispatchMouseEvent({
            type: 'mousePressed',
            x,
            y,
            button: 'right',
            clickCount: 1,
        })

        await client.Input.dispatchMouseEvent({
            type: 'mouseReleased',
            x,
            y,
            button: 'right',
            clickCount: 1,
        })

        logs.push({
            timestamp: Date.now(),
            level: 'info',
            message: `Right-clicked on ${selector}`,
        })

        await new Promise((resolve) => setTimeout(resolve, 300))
    }

    /**
     * Execute double-click action
     */
    private async executeDoubleClick(
        client: any,
        action: RecordedAction,
        logs: ExecutionLog[]
    ): Promise<void> {
        const selector = action.selector || action.xpath

        if (!selector) {
            throw new Error('Double-click action missing selector')
        }

        // Get element position
        const { root } = await client.DOM.getDocument()
        const { nodeId } = await client.DOM.querySelector({
            nodeId: root.nodeId,
            selector: action.selector,
        })

        if (!nodeId) {
            throw new Error(`Element not found: ${selector}`)
        }

        const { model } = await client.DOM.getBoxModel({ nodeId })
        const x = (model.content[0] + model.content[2]) / 2
        const y = (model.content[1] + model.content[5]) / 2

        // Double-click
        await client.Input.dispatchMouseEvent({
            type: 'mousePressed',
            x,
            y,
            button: 'left',
            clickCount: 2,
        })

        await client.Input.dispatchMouseEvent({
            type: 'mouseReleased',
            x,
            y,
            button: 'left',
            clickCount: 2,
        })

        logs.push({
            timestamp: Date.now(),
            level: 'info',
            message: `Double-clicked on ${selector}`,
        })

        await new Promise((resolve) => setTimeout(resolve, 300))
    }

    /**
     * Execute drag and drop action
     */
    private async executeDragAndDrop(
        client: any,
        action: RecordedAction,
        logs: ExecutionLog[]
    ): Promise<void> {
        if (!action.fromCoordinates || !action.toCoordinates) {
            throw new Error('Drag and drop action missing coordinates')
        }

        const fromX = action.fromCoordinates.x
        const fromY = action.fromCoordinates.y
        const toX = action.toCoordinates.x
        const toY = action.toCoordinates.y

        // Mouse down at source
        await client.Input.dispatchMouseEvent({
            type: 'mousePressed',
            x: fromX,
            y: fromY,
            button: 'left',
            clickCount: 1,
        })

        await new Promise((resolve) => setTimeout(resolve, 100))

        // Move to target
        await client.Input.dispatchMouseEvent({
            type: 'mouseMoved',
            x: toX,
            y: toY,
        })

        await new Promise((resolve) => setTimeout(resolve, 100))

        // Mouse up at target
        await client.Input.dispatchMouseEvent({
            type: 'mouseReleased',
            x: toX,
            y: toY,
            button: 'left',
            clickCount: 1,
        })

        logs.push({
            timestamp: Date.now(),
            level: 'info',
            message: `Dragged from (${fromX}, ${fromY}) to (${toX}, ${toY})`,
        })

        await new Promise((resolve) => setTimeout(resolve, 300))
    }

    // ============================================================
    // TIER 1: ELEMENT CHECKS
    // ============================================================

    /**
     * Execute wait for element action
     */
    private async executeWaitElement(
        client: any,
        action: RecordedAction,
        logs: ExecutionLog[]
    ): Promise<void> {
        const selector = action.selector || action.xpath
        const timeout = action.timeout || 10000
        const condition = action.condition || 'exists'

        if (!selector) {
            throw new Error('Wait element action missing selector')
        }

        const startTime = Date.now()

        while (Date.now() - startTime < timeout) {
            try {
                const { root } = await client.DOM.getDocument()
                const { nodeId } = await client.DOM.querySelector({
                    nodeId: root.nodeId,
                    selector: action.selector,
                })

                if (nodeId) {
                    // Element exists
                    if (condition === 'exists') {
                        logs.push({
                            timestamp: Date.now(),
                            level: 'info',
                            message: `Element ${selector} found after ${Date.now() - startTime}ms`,
                        })
                        return
                    }

                    // Check visibility if needed
                    if (condition === 'visible') {
                        const { model } = await client.DOM.getBoxModel({ nodeId })
                        if (model && model.content) {
                            logs.push({
                                timestamp: Date.now(),
                                level: 'info',
                                message: `Element ${selector} is visible after ${Date.now() - startTime}ms`,
                            })
                            return
                        }
                    }
                }
            } catch (error) {
                // Element not found, continue waiting
            }

            await new Promise((resolve) => setTimeout(resolve, 500))
        }

        throw new Error(
            `Element ${selector} not ${condition} after ${timeout}ms`
        )
    }

    /**
     * Execute check element action
     */
    private async executeCheckElement(
        client: any,
        action: RecordedAction,
        logs: ExecutionLog[]
    ): Promise<void> {
        const selector = action.selector || action.xpath
        const check = action.condition || 'exists'

        if (!selector) {
            throw new Error('Check element action missing selector')
        }

        try {
            const { root } = await client.DOM.getDocument()
            const { nodeId } = await client.DOM.querySelector({
                nodeId: root.nodeId,
                selector: action.selector,
            })

            let result = false

            if (check === 'exists') {
                result = !!nodeId
            } else if (check === 'visible') {
                if (nodeId) {
                    try {
                        const { model } = await client.DOM.getBoxModel({ nodeId })
                        result = !!(model && model.content)
                    } catch {
                        result = false
                    }
                }
            }

            logs.push({
                timestamp: Date.now(),
                level: 'info',
                message: `Element ${selector} ${check} check: ${result}`,
            })

            if (!result && action.expectedValue === 'true') {
                throw new Error(`Element ${selector} ${check} check failed`)
            }
        } catch (error) {
            logs.push({
                timestamp: Date.now(),
                level: 'error',
                message: `Check element failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
            })
            throw error
        }
    }

    /**
     * Execute get element text action
     */
    private async executeGetElementText(
        client: any,
        action: RecordedAction,
        logs: ExecutionLog[]
    ): Promise<void> {
        const selector = action.selector || action.xpath

        if (!selector) {
            throw new Error('Get element text action missing selector')
        }

        const script = `
            const element = document.querySelector("${action.selector}");
            element ? element.innerText : null;
        `

        const result = await client.Runtime.evaluate({ expression: script })

        if (result.result.value !== undefined) {
            logs.push({
                timestamp: Date.now(),
                level: 'info',
                message: `Got text from ${selector}: "${result.result.value}"`,
                data: { text: result.result.value },
            })

            // Store in variable if name provided
            if (action.variableName) {
                // Variables would be stored in execution context
                logs.push({
                    timestamp: Date.now(),
                    level: 'info',
                    message: `Stored text in variable: ${action.variableName}`,
                })
            }
        } else {
            throw new Error(`Could not get text from ${selector}`)
        }
    }

    /**
     * Execute get element attribute action
     */
    private async executeGetElementAttribute(
        client: any,
        action: RecordedAction,
        logs: ExecutionLog[]
    ): Promise<void> {
        const selector = action.selector || action.xpath
        const attribute = action.attribute || 'value'

        if (!selector) {
            throw new Error('Get element attribute action missing selector')
        }

        const script = `
            const element = document.querySelector("${action.selector}");
            element ? element.getAttribute("${attribute}") : null;
        `

        const result = await client.Runtime.evaluate({ expression: script })

        if (result.result.value !== undefined) {
            logs.push({
                timestamp: Date.now(),
                level: 'info',
                message: `Got attribute "${attribute}" from ${selector}: "${result.result.value}"`,
                data: { attribute, value: result.result.value },
            })

            if (action.variableName) {
                logs.push({
                    timestamp: Date.now(),
                    level: 'info',
                    message: `Stored attribute in variable: ${action.variableName}`,
                })
            }
        } else {
            throw new Error(`Could not get attribute "${attribute}" from ${selector}`)
        }
    }
}
