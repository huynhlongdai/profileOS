import CDP from 'chrome-remote-interface'

interface ExecutionLog {
    timestamp: number
    level: 'info' | 'warning' | 'error'
    message: string
    data?: unknown
}

interface WorkflowStep {
    id: string
    action: string
    label: string
    params: Record<string, string | number | boolean>
    children?: WorkflowStep[]
    elseChildren?: WorkflowStep[]
    enabled: boolean
}

interface WorkflowResult {
    success: boolean
    logs: ExecutionLog[]
    stats: {
        totalActions: number
        successfulActions: number
        failedActions: number
        duration: number
    }
    variables: Record<string, string>
}

class BreakSignal extends Error { constructor() { super('BREAK_LOOP') } }
class ContinueSignal extends Error { constructor() { super('CONTINUE_LOOP') } }

export class WorkflowExecutor {
    private client: any = null
    private logs: ExecutionLog[] = []
    private variables: Record<string, string> = {}
    private successCount = 0
    private failCount = 0
    private totalCount = 0

    private log(level: ExecutionLog['level'], message: string, data?: unknown) {
        this.logs.push({ timestamp: Date.now(), level, message, data })
    }

    async execute(
        steps: WorkflowStep[],
        remoteDebuggingPort: number,
        inputVariables: Record<string, string> = {}
    ): Promise<WorkflowResult> {
        const startTime = Date.now()
        this.variables = { ...inputVariables }
        this.logs = []
        this.successCount = 0
        this.failCount = 0
        this.totalCount = 0

        try {
            const CDPModule = (await import('chrome-remote-interface')).default
            this.client = await CDPModule({ port: remoteDebuggingPort })
            this.log('info', `Connected to browser on port ${remoteDebuggingPort}`)

            await this.client.Page.enable()
            await this.client.Runtime.enable()
            await this.client.DOM.enable()
            await this.client.Input.enable()
            await this.client.Network.enable()

            await this.executeSteps(steps)

            return {
                success: this.failCount === 0,
                logs: this.logs,
                stats: {
                    totalActions: this.totalCount,
                    successfulActions: this.successCount,
                    failedActions: this.failCount,
                    duration: Date.now() - startTime,
                },
                variables: this.variables,
            }
        } catch (error) {
            const msg = error instanceof Error ? error.message : 'Unknown error'
            this.log('error', `Execution failed: ${msg}`)
            return {
                success: false,
                logs: this.logs,
                stats: {
                    totalActions: this.totalCount,
                    successfulActions: this.successCount,
                    failedActions: this.failCount,
                    duration: Date.now() - startTime,
                },
                variables: this.variables,
            }
        } finally {
            if (this.client) {
                try { await this.client.close() } catch { /* ignore */ }
                this.log('info', 'Disconnected from browser')
            }
        }
    }

    private resolveVars(text: string | number | boolean): string {
        if (typeof text !== 'string') return String(text)
        return text.replace(/\$\{(\w+)\}/g, (_, name) => this.variables[name] ?? '')
    }

    private async executeSteps(steps: WorkflowStep[]): Promise<void> {
        for (const step of steps) {
            if (!step.enabled) continue
            await this.executeStep(step)
            await this.delay(300)
        }
    }

    private async executeStep(step: WorkflowStep): Promise<void> {
        this.totalCount++
        this.log('info', `[${step.id}] ${step.label} (${step.action})`)

        try {
            switch (step.action) {
                // Navigation
                case 'go_to_url': await this.goToUrl(step); break
                case 'new_tab': await this.newTab(step); break
                case 'close_tab': await this.closeTab(); break
                case 'active_tab': await this.activeTab(step); break
                case 'reload': await this.reload(); break
                case 'back': await this.goBack(); break
                case 'forward': await this.goForward(); break
                case 'get_url': await this.getUrl(step); break
                case 'wait_url_changed': await this.waitUrlChanged(step); break

                // Mouse
                case 'click': await this.click(step); break
                case 'double_click': await this.doubleClick(step); break
                case 'right_click': await this.rightClick(step); break
                case 'hover': await this.hover(step); break
                case 'click_coordinates': await this.clickCoordinates(step); break
                case 'drag_and_drop': await this.dragAndDrop(step); break
                case 'scroll': await this.scroll(step); break
                case 'random_scroll': await this.randomScroll(step); break
                case 'scroll_to_element': await this.scrollToElement(step); break
                case 'try_click': await this.tryClick(step); break

                // Keyboard
                case 'type': await this.typeText(step); break
                case 'key_press': await this.keyPress(step); break
                case 'select_dropdown': await this.selectDropdown(step); break
                case 'file_upload': await this.fileUpload(step); break

                // Element
                case 'wait_element': await this.waitElement(step); break
                case 'element_exists': await this.elementExists(step); break
                case 'get_text': await this.getText(step); break
                case 'get_attribute': await this.getAttribute(step); break
                case 'count_elements': await this.countElements(step); break

                // Control Flow
                case 'if_condition': await this.ifCondition(step); break
                case 'for_loop': await this.forLoop(step); break
                case 'while_loop': await this.whileLoop(step); break
                case 'try_catch': await this.tryCatch(step); break
                case 'break_loop': throw new BreakSignal()
                case 'continue_loop': throw new ContinueSignal()
                case 'delay': await this.delayAction(step); break

                // Data & Variables
                case 'set_variable': await this.setVariable(step); break
                case 'increment_variable': await this.incrementVariable(step); break
                case 'math_execute': await this.mathExecute(step); break
                case 'random_number': await this.randomNumber(step); break
                case 'random_text': await this.randomText(step); break

                // Text Operations
                case 'split_text': await this.splitText(step); break
                case 'regex_extract': await this.regexExtract(step); break
                case 'parse_json': await this.parseJson(step); break

                // Code & HTTP
                case 'execute_js': await this.executeJs(step); break
                case 'http_request': await this.httpRequest(step); break
                case 'http_download': await this.httpDownload(step); break
                case 'screenshot': await this.screenshot(step); break
                case 'log': await this.logAction(step); break

                // Alert
                case 'accept_alert': await this.acceptAlert(); break
                case 'dismiss_alert': await this.dismissAlert(); break

                // Cookie & Clipboard
                case 'cookie_import': await this.cookieImport(step); break
                case 'cookie_export': await this.cookieExport(step); break
                case 'get_clipboard': await this.getClipboard(step); break
                case 'set_clipboard': await this.setClipboard(step); break

                // Frame & Popup
                case 'switch_to_frame': await this.switchToFrame(step); break
                case 'switch_to_default': await this.switchToDefault(); break
                case 'switch_to_popup': await this.switchToPopup(step); break

                // Advanced
                case 'get_2fa': await this.get2fa(step); break
                case 'read_mail_otp': await this.readMailOtp(step); break
                case 'ai_generate': await this.aiGenerate(step); break

                default:
                    this.log('warning', `Unknown action: ${step.action}`)
            }
            this.successCount++
        } catch (error) {
            if (error instanceof BreakSignal || error instanceof ContinueSignal) throw error
            this.failCount++
            const msg = error instanceof Error ? error.message : 'Unknown error'
            this.log('error', `[${step.id}] Failed: ${msg}`)
        }
    }

    // ============ Utility ============

    private delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms))
    }

    private async evalJs(expression: string): Promise<any> {
        const result = await this.client.Runtime.evaluate({
            expression,
            returnByValue: true,
            awaitPromise: true,
        })
        if (result.exceptionDetails) {
            throw new Error(result.exceptionDetails.text || 'JS evaluation error')
        }
        return result.result?.value
    }

    private async findElementByXPath(xpath: string, timeout = 5000): Promise<{ x: number; y: number }> {
        const resolvedXpath = this.resolveVars(xpath)
        const startTime = Date.now()

        while (Date.now() - startTime < timeout) {
            const result = await this.evalJs(`
                (function() {
                    const el = document.evaluate(
                        ${JSON.stringify(resolvedXpath)},
                        document,
                        null,
                        XPathResult.FIRST_ORDERED_NODE_TYPE,
                        null
                    ).singleNodeValue;
                    if (!el) return null;
                    const rect = el.getBoundingClientRect();
                    return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2, w: rect.width, h: rect.height };
                })()
            `)
            if (result) return result
            await this.delay(500)
        }
        throw new Error(`Element not found: ${resolvedXpath}`)
    }

    // ============ Navigation ============

    private async goToUrl(step: WorkflowStep) {
        const url = this.resolveVars(step.params.url)
        await this.client.Page.navigate({ url })
        await this.client.Page.loadEventFired()
        this.log('info', `Navigated to ${url}`)
    }

    private async newTab(step: WorkflowStep) {
        const url = this.resolveVars(step.params.url || 'about:blank')
        await this.client.Target.createTarget({ url })
        this.log('info', `Opened new tab: ${url}`)
    }

    private async closeTab() {
        await this.evalJs('window.close()')
        this.log('info', 'Closed current tab')
    }

    private async reload() {
        await this.client.Page.reload()
        await this.client.Page.loadEventFired()
        this.log('info', 'Page reloaded')
    }

    private async goBack() {
        await this.evalJs('history.back()')
        await this.delay(1000)
        this.log('info', 'Navigated back')
    }

    private async waitUrlChanged(step: WorkflowStep) {
        const timeout = Number(step.params.timeout) || 10000
        const currentUrl = await this.evalJs('window.location.href')
        const startTime = Date.now()
        while (Date.now() - startTime < timeout) {
            const newUrl = await this.evalJs('window.location.href')
            if (newUrl !== currentUrl) {
                this.log('info', `URL changed to ${newUrl}`)
                return
            }
            await this.delay(500)
        }
        throw new Error('URL did not change within timeout')
    }

    // ============ Mouse ============

    private async click(step: WorkflowStep) {
        const timeout = Number(step.params.timeout) || 5000
        const pos = await this.findElementByXPath(String(step.params.xpath), timeout)
        await this.client.Input.dispatchMouseEvent({ type: 'mousePressed', x: pos.x, y: pos.y, button: 'left', clickCount: 1 })
        await this.client.Input.dispatchMouseEvent({ type: 'mouseReleased', x: pos.x, y: pos.y, button: 'left', clickCount: 1 })
        this.log('info', `Clicked at (${pos.x}, ${pos.y})`)
    }

    private async doubleClick(step: WorkflowStep) {
        const timeout = Number(step.params.timeout) || 5000
        const pos = await this.findElementByXPath(String(step.params.xpath), timeout)
        await this.client.Input.dispatchMouseEvent({ type: 'mousePressed', x: pos.x, y: pos.y, button: 'left', clickCount: 2 })
        await this.client.Input.dispatchMouseEvent({ type: 'mouseReleased', x: pos.x, y: pos.y, button: 'left', clickCount: 2 })
        this.log('info', `Double clicked at (${pos.x}, ${pos.y})`)
    }

    private async rightClick(step: WorkflowStep) {
        const timeout = Number(step.params.timeout) || 5000
        const pos = await this.findElementByXPath(String(step.params.xpath), timeout)
        await this.client.Input.dispatchMouseEvent({ type: 'mousePressed', x: pos.x, y: pos.y, button: 'right', clickCount: 1 })
        await this.client.Input.dispatchMouseEvent({ type: 'mouseReleased', x: pos.x, y: pos.y, button: 'right', clickCount: 1 })
        this.log('info', `Right clicked at (${pos.x}, ${pos.y})`)
    }

    private async hover(step: WorkflowStep) {
        const pos = await this.findElementByXPath(String(step.params.xpath))
        await this.client.Input.dispatchMouseEvent({ type: 'mouseMoved', x: pos.x, y: pos.y })
        this.log('info', `Hovered at (${pos.x}, ${pos.y})`)
    }

    private async scroll(step: WorkflowStep) {
        const direction = String(step.params.direction || 'down')
        const amount = Number(step.params.amount) || 300
        let js = ''
        switch (direction) {
            case 'down': js = `window.scrollBy(0, ${amount})`; break
            case 'up': js = `window.scrollBy(0, -${amount})`; break
            case 'top': js = `window.scrollTo(0, 0)`; break
            case 'bottom': js = `window.scrollTo(0, document.body.scrollHeight)`; break
        }
        await this.evalJs(js)
        this.log('info', `Scrolled ${direction} ${amount}px`)
    }

    private async tryClick(step: WorkflowStep) {
        const maxTries = Number(step.params.maxTries) || 5
        const delayMs = Number(step.params.delayMs) || 1000
        const xpath = String(step.params.xpath)

        for (let i = 0; i < maxTries; i++) {
            try {
                const pos = await this.findElementByXPath(xpath, 2000)
                await this.client.Input.dispatchMouseEvent({ type: 'mousePressed', x: pos.x, y: pos.y, button: 'left', clickCount: 1 })
                await this.client.Input.dispatchMouseEvent({ type: 'mouseReleased', x: pos.x, y: pos.y, button: 'left', clickCount: 1 })
                this.log('info', `Try click succeeded on attempt ${i + 1}`)
                return
            } catch {
                if (i < maxTries - 1) await this.delay(delayMs)
            }
        }
        throw new Error(`Try click failed after ${maxTries} attempts`)
    }

    // ============ Keyboard ============

    private async typeText(step: WorkflowStep) {
        const xpath = String(step.params.xpath)
        const text = this.resolveVars(step.params.text)
        const clearFirst = step.params.clearFirst !== false

        const pos = await this.findElementByXPath(xpath)
        await this.client.Input.dispatchMouseEvent({ type: 'mousePressed', x: pos.x, y: pos.y, button: 'left', clickCount: 1 })
        await this.client.Input.dispatchMouseEvent({ type: 'mouseReleased', x: pos.x, y: pos.y, button: 'left', clickCount: 1 })
        await this.delay(200)

        if (clearFirst) {
            await this.evalJs(`
                (function() {
                    const el = document.evaluate(${JSON.stringify(this.resolveVars(xpath))}, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
                    if (el) { el.value = ''; el.dispatchEvent(new Event('input', {bubbles: true})); }
                })()
            `)
        }

        for (const char of text) {
            await this.client.Input.dispatchKeyEvent({ type: 'char', text: char })
            await this.delay(50 + Math.random() * 50)
        }
        this.log('info', `Typed "${text.slice(0, 30)}..." into element`)
    }

    private async keyPress(step: WorkflowStep) {
        const key = this.resolveVars(step.params.key)
        const keyMap: Record<string, { key: string; code: string; keyCode: number }> = {
            'Enter': { key: 'Enter', code: 'Enter', keyCode: 13 },
            'Tab': { key: 'Tab', code: 'Tab', keyCode: 9 },
            'Escape': { key: 'Escape', code: 'Escape', keyCode: 27 },
            'Backspace': { key: 'Backspace', code: 'Backspace', keyCode: 8 },
            'Delete': { key: 'Delete', code: 'Delete', keyCode: 46 },
            'ArrowUp': { key: 'ArrowUp', code: 'ArrowUp', keyCode: 38 },
            'ArrowDown': { key: 'ArrowDown', code: 'ArrowDown', keyCode: 40 },
            'ArrowLeft': { key: 'ArrowLeft', code: 'ArrowLeft', keyCode: 37 },
            'ArrowRight': { key: 'ArrowRight', code: 'ArrowRight', keyCode: 39 },
        }
        const mapped = keyMap[key] || { key, code: `Key${key.toUpperCase()}`, keyCode: key.charCodeAt(0) }
        await this.client.Input.dispatchKeyEvent({ type: 'keyDown', ...mapped })
        await this.client.Input.dispatchKeyEvent({ type: 'keyUp', ...mapped })
        this.log('info', `Pressed key: ${key}`)
    }

    private async selectDropdown(step: WorkflowStep) {
        const xpath = String(step.params.xpath)
        const value = this.resolveVars(step.params.value)
        await this.evalJs(`
            (function() {
                const el = document.evaluate(${JSON.stringify(this.resolveVars(xpath))}, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
                if (el) { el.value = ${JSON.stringify(value)}; el.dispatchEvent(new Event('change', {bubbles: true})); }
            })()
        `)
        this.log('info', `Selected "${value}" in dropdown`)
    }

    private async fileUpload(step: WorkflowStep) {
        const xpath = String(step.params.xpath)
        const filePath = this.resolveVars(step.params.filePath)
        const { root } = await this.client.DOM.getDocument()
        const { searchId } = await this.client.DOM.performSearch({
            query: this.resolveVars(xpath),
        })
        const { nodeIds } = await this.client.DOM.getSearchResults({
            searchId,
            fromIndex: 0,
            toIndex: 1,
        })
        if (nodeIds.length > 0) {
            await this.client.DOM.setFileInputFiles({
                nodeId: nodeIds[0],
                files: [filePath],
            })
        }
        this.log('info', `Uploaded file: ${filePath}`)
    }

    // ============ Element ============

    private async waitElement(step: WorkflowStep) {
        const timeout = Number(step.params.timeout) || 10000
        await this.findElementByXPath(String(step.params.xpath), timeout)
        this.log('info', `Element found: ${step.params.xpath}`)
    }

    private async getText(step: WorkflowStep) {
        const xpath = String(step.params.xpath)
        const saveAs = String(step.params.saveAs || '')
        const text = await this.evalJs(`
            (function() {
                const el = document.evaluate(${JSON.stringify(this.resolveVars(xpath))}, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
                return el ? (el.textContent || el.innerText || '') : '';
            })()
        `)
        if (saveAs) this.variables[saveAs] = String(text)
        this.log('info', `Got text: "${String(text).slice(0, 50)}" → $${saveAs}`)
    }

    private async getAttribute(step: WorkflowStep) {
        const xpath = String(step.params.xpath)
        const attr = String(step.params.attribute || 'href')
        const saveAs = String(step.params.saveAs || '')
        const value = await this.evalJs(`
            (function() {
                const el = document.evaluate(${JSON.stringify(this.resolveVars(xpath))}, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
                return el ? el.getAttribute(${JSON.stringify(attr)}) : '';
            })()
        `)
        if (saveAs) this.variables[saveAs] = String(value)
        this.log('info', `Got attribute ${attr}: "${String(value).slice(0, 50)}" → $${saveAs}`)
    }

    private async countElements(step: WorkflowStep) {
        const xpath = String(step.params.xpath)
        const saveAs = String(step.params.saveAs || '')
        const count = await this.evalJs(`
            (function() {
                const result = document.evaluate(${JSON.stringify(this.resolveVars(xpath))}, document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
                return result.snapshotLength;
            })()
        `)
        if (saveAs) this.variables[saveAs] = String(count)
        this.log('info', `Count elements: ${count} → $${saveAs}`)
    }

    // ============ Control Flow ============

    private async ifCondition(step: WorkflowStep) {
        const left = this.resolveVars(step.params.left)
        const operator = String(step.params.operator)
        const right = this.resolveVars(step.params.right)

        let result = false
        switch (operator) {
            case '=': case '==': result = left === right; break
            case '!=': result = left !== right; break
            case '>': result = Number(left) > Number(right); break
            case '<': result = Number(left) < Number(right); break
            case '>=': result = Number(left) >= Number(right); break
            case '<=': result = Number(left) <= Number(right); break
            case 'contains': result = left.includes(right); break
            case '!contains': result = !left.includes(right); break
            case 'hasElement':
                try {
                    await this.findElementByXPath(left, 2000)
                    result = true
                } catch { result = false }
                break
            case '!hasElement':
                try {
                    await this.findElementByXPath(left, 2000)
                    result = false
                } catch { result = true }
                break
        }

        this.log('info', `If: ${left} ${operator} ${right} → ${result}`)

        if (result && step.children?.length) {
            await this.executeSteps(step.children)
        } else if (!result && step.elseChildren?.length) {
            await this.executeSteps(step.elseChildren)
        }
    }

    private async forLoop(step: WorkflowStep) {
        const count = Number(step.params.count) || 1
        const variable = String(step.params.variable || 'i')

        this.log('info', `For loop: ${count} iterations`)
        for (let i = 0; i < count; i++) {
            this.variables[variable] = String(i)
            this.variables['loopIndex'] = String(i)
            if (step.children?.length) {
                try {
                    await this.executeSteps(step.children)
                } catch (e) {
                    if (e instanceof BreakSignal) break
                    if (e instanceof ContinueSignal) continue
                    throw e
                }
            }
        }
    }

    private async whileLoop(step: WorkflowStep) {
        const maxIterations = Number(step.params.maxIterations) || 100
        const condition = this.resolveVars(step.params.condition)

        this.log('info', `While loop: max ${maxIterations} iterations`)
        let iterations = 0
        while (iterations < maxIterations) {
            const result = await this.evalJs(condition)
            if (!result) break
            if (step.children?.length) {
                try {
                    await this.executeSteps(step.children)
                } catch (e) {
                    if (e instanceof BreakSignal) break
                    if (e instanceof ContinueSignal) { iterations++; continue }
                    throw e
                }
            }
            iterations++
        }
    }

    private async tryCatch(step: WorkflowStep) {
        try {
            if (step.children?.length) {
                await this.executeSteps(step.children)
            }
            this.log('info', 'Try block completed successfully')
        } catch (error) {
            if (error instanceof BreakSignal || error instanceof ContinueSignal) throw error
            const msg = error instanceof Error ? error.message : 'Unknown error'
            this.log('warning', `Try block failed: ${msg}, executing catch block`)
            this.variables['errorMessage'] = msg
            if (step.elseChildren?.length) {
                await this.executeSteps(step.elseChildren)
            }
        }
    }

    private async delayAction(step: WorkflowStep) {
        const ms = Number(step.params.ms) || 1000
        this.log('info', `Waiting ${ms}ms`)
        await this.delay(ms)
    }

    // ============ Data ============

    private async setVariable(step: WorkflowStep) {
        const name = String(step.params.name)
        const value = this.resolveVars(step.params.value)
        this.variables[name] = value
        this.log('info', `Set $${name} = "${value.slice(0, 50)}"`)
    }

    private async executeJs(step: WorkflowStep) {
        const code = this.resolveVars(step.params.code)
        const result = await this.evalJs(code)
        this.log('info', `JS result: ${JSON.stringify(result).slice(0, 100)}`)
    }

    private async httpRequest(step: WorkflowStep) {
        const method = String(step.params.method || 'GET')
        const url = this.resolveVars(step.params.url)
        const body = step.params.body ? this.resolveVars(step.params.body) : undefined
        const saveAs = String(step.params.saveAs || '')

        const fetchCode = `
            fetch(${JSON.stringify(url)}, {
                method: ${JSON.stringify(method)},
                ${body ? `body: ${JSON.stringify(body)},` : ''}
                ${body ? `headers: { 'Content-Type': 'application/json' },` : ''}
            }).then(r => r.text())
        `
        const result = await this.evalJs(fetchCode)
        if (saveAs) this.variables[saveAs] = String(result)
        this.log('info', `HTTP ${method} ${url} → ${String(result).slice(0, 100)}`)
    }

    private async screenshot(step: WorkflowStep) {
        const { data } = await this.client.Page.captureScreenshot({ format: 'png' })
        this.log('info', `Screenshot captured (${data.length} chars base64)`)
    }

    private async logAction(step: WorkflowStep) {
        const message = this.resolveVars(step.params.message)
        const level = String(step.params.level || 'info') as ExecutionLog['level']
        this.log(level, `[USER LOG] ${message}`)
    }

    // ============ Navigation (new) ============

    private async goForward() {
        await this.evalJs('history.forward()')
        await this.delay(1000)
        this.log('info', 'Navigated forward')
    }

    private async getUrl(step: WorkflowStep) {
        const saveAs = String(step.params.saveAs || 'currentUrl')
        const url = await this.evalJs('window.location.href')
        this.variables[saveAs] = String(url)
        this.log('info', `Current URL: ${url} → $${saveAs}`)
    }

    private async activeTab(step: WorkflowStep) {
        const tabIndex = Number(step.params.tabIndex) || 0
        const targets = await this.client.Target.getTargets()
        const pages = targets.targetInfos?.filter((t: any) => t.type === 'page') || []
        if (tabIndex < pages.length) {
            await this.client.Target.activateTarget({ targetId: pages[tabIndex].targetId })
            this.log('info', `Switched to tab ${tabIndex}: ${pages[tabIndex].title}`)
        } else {
            this.log('warning', `Tab index ${tabIndex} out of range (${pages.length} tabs)`)
        }
    }

    // ============ Mouse (new) ============

    private async clickCoordinates(step: WorkflowStep) {
        const x = Number(step.params.x) || 0
        const y = Number(step.params.y) || 0
        await this.client.Input.dispatchMouseEvent({ type: 'mousePressed', x, y, button: 'left', clickCount: 1 })
        await this.client.Input.dispatchMouseEvent({ type: 'mouseReleased', x, y, button: 'left', clickCount: 1 })
        this.log('info', `Clicked at coordinates (${x}, ${y})`)
    }

    private async dragAndDrop(step: WorkflowStep) {
        const from = await this.findElementByXPath(String(step.params.fromXpath))
        const to = await this.findElementByXPath(String(step.params.toXpath))
        await this.client.Input.dispatchMouseEvent({ type: 'mousePressed', x: from.x, y: from.y, button: 'left', clickCount: 1 })
        await this.delay(100)
        const steps = 10
        for (let i = 1; i <= steps; i++) {
            const x = from.x + (to.x - from.x) * (i / steps)
            const y = from.y + (to.y - from.y) * (i / steps)
            await this.client.Input.dispatchMouseEvent({ type: 'mouseMoved', x, y })
            await this.delay(30)
        }
        await this.client.Input.dispatchMouseEvent({ type: 'mouseReleased', x: to.x, y: to.y, button: 'left', clickCount: 1 })
        this.log('info', `Dragged from (${from.x},${from.y}) to (${to.x},${to.y})`)
    }

    private async randomScroll(step: WorkflowStep) {
        const min = Number(step.params.minAmount) || 100
        const max = Number(step.params.maxAmount) || 500
        const direction = String(step.params.direction || 'down')
        const amount = Math.floor(Math.random() * (max - min + 1)) + min
        const sign = direction === 'up' ? -1 : 1
        await this.evalJs(`window.scrollBy(0, ${sign * amount})`)
        this.log('info', `Random scrolled ${direction} ${amount}px`)
    }

    private async scrollToElement(step: WorkflowStep) {
        const xpath = this.resolveVars(String(step.params.xpath))
        await this.evalJs(`
            (function() {
                const el = document.evaluate(${JSON.stringify(xpath)}, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
                if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                return !!el;
            })()
        `)
        this.log('info', `Scrolled to element: ${xpath}`)
    }

    // ============ Element (new) ============

    private async elementExists(step: WorkflowStep) {
        const xpath = String(step.params.xpath)
        const saveAs = String(step.params.saveAs || 'exists')
        const timeout = Number(step.params.timeout) || 3000
        try {
            await this.findElementByXPath(xpath, timeout)
            this.variables[saveAs] = 'true'
            this.log('info', `Element exists: ${xpath} → true`)
        } catch {
            this.variables[saveAs] = 'false'
            this.log('info', `Element not found: ${xpath} → false`)
        }
    }

    // ============ Data & Variables (new) ============

    private async incrementVariable(step: WorkflowStep) {
        const name = String(step.params.name)
        const amount = Number(step.params.amount) || 1
        const current = Number(this.variables[name] || '0')
        this.variables[name] = String(current + amount)
        this.log('info', `Incremented $${name}: ${current} + ${amount} = ${current + amount}`)
    }

    private async mathExecute(step: WorkflowStep) {
        const expr = this.resolveVars(String(step.params.expression))
        const saveAs = String(step.params.saveAs || 'mathResult')
        const sanitized = expr.replace(/[^0-9+\-*/%().\s]/g, '')
        const result = await this.evalJs(`(${sanitized})`)
        this.variables[saveAs] = String(result)
        this.log('info', `Math: ${expr} = ${result} → $${saveAs}`)
    }

    private async randomNumber(step: WorkflowStep) {
        const min = Number(step.params.min) || 0
        const max = Number(step.params.max) || 100
        const saveAs = String(step.params.saveAs || 'randomNum')
        const num = Math.floor(Math.random() * (max - min + 1)) + min
        this.variables[saveAs] = String(num)
        this.log('info', `Random number: ${num} (${min}-${max}) → $${saveAs}`)
    }

    private async randomText(step: WorkflowStep) {
        const length = Number(step.params.length) || 8
        const charset = String(step.params.charset || 'alphanumeric')
        const saveAs = String(step.params.saveAs || 'randomText')
        const charsets: Record<string, string> = {
            alphanumeric: 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',
            alpha: 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ',
            numeric: '0123456789',
            hex: '0123456789abcdef',
            email: 'abcdefghijklmnopqrstuvwxyz0123456789',
        }
        const chars = charsets[charset] || charsets.alphanumeric
        let result = ''
        for (let i = 0; i < length; i++) result += chars[Math.floor(Math.random() * chars.length)]
        this.variables[saveAs] = result
        this.log('info', `Random text: "${result}" → $${saveAs}`)
    }

    // ============ Text Operations ============

    private async splitText(step: WorkflowStep) {
        const text = this.resolveVars(String(step.params.text))
        const delimiter = String(step.params.delimiter || ',')
        const index = Number(step.params.index) || 0
        const saveAs = String(step.params.saveAs || 'splitResult')
        const parts = text.split(delimiter)
        const result = index >= 0 && index < parts.length ? parts[index] : ''
        this.variables[saveAs] = result.trim()
        this.log('info', `Split text by "${delimiter}" [${index}] = "${result.trim()}" → $${saveAs}`)
    }

    private async regexExtract(step: WorkflowStep) {
        const text = this.resolveVars(String(step.params.text))
        const pattern = String(step.params.pattern)
        const group = Number(step.params.group) || 0
        const saveAs = String(step.params.saveAs || 'regexResult')
        try {
            const regex = new RegExp(pattern)
            const match = text.match(regex)
            const result = match ? (match[group] || match[0] || '') : ''
            this.variables[saveAs] = result
            this.log('info', `Regex /${pattern}/ [${group}] = "${result}" → $${saveAs}`)
        } catch (e) {
            this.log('error', `Invalid regex: ${pattern}`)
        }
    }

    private async parseJson(step: WorkflowStep) {
        const json = this.resolveVars(String(step.params.json))
        const path = String(step.params.path)
        const saveAs = String(step.params.saveAs || 'jsonValue')
        try {
            const obj = JSON.parse(json)
            const keys = path.split('.').filter(Boolean)
            let value: unknown = obj
            for (const key of keys) {
                if (value && typeof value === 'object') {
                    value = (value as Record<string, unknown>)[key]
                } else {
                    value = undefined
                    break
                }
            }
            const result = typeof value === 'object' ? JSON.stringify(value) : String(value ?? '')
            this.variables[saveAs] = result
            this.log('info', `JSON path "${path}" = "${result.slice(0, 50)}" → $${saveAs}`)
        } catch (e) {
            this.log('error', `Failed to parse JSON: ${e instanceof Error ? e.message : 'Invalid JSON'}`)
        }
    }

    // ============ HTTP (new) ============

    private async httpDownload(step: WorkflowStep) {
        const url = this.resolveVars(String(step.params.url))
        const savePath = this.resolveVars(String(step.params.savePath))
        this.log('info', `Download ${url} → ${savePath} (requires agent for file system)`)
    }

    // ============ Alert ============

    private async acceptAlert() {
        try {
            await this.client.Page.handleJavaScriptDialog({ accept: true })
            this.log('info', 'Accepted alert dialog')
        } catch {
            this.log('warning', 'No alert dialog to accept')
        }
    }

    private async dismissAlert() {
        try {
            await this.client.Page.handleJavaScriptDialog({ accept: false })
            this.log('info', 'Dismissed alert dialog')
        } catch {
            this.log('warning', 'No alert dialog to dismiss')
        }
    }

    // ============ Clipboard ============

    private async getClipboard(step: WorkflowStep) {
        const saveAs = String(step.params.saveAs || 'clipboard')
        const text = await this.evalJs('navigator.clipboard.readText().catch(() => "")')
        this.variables[saveAs] = String(text)
        this.log('info', `Clipboard: "${String(text).slice(0, 50)}" → $${saveAs}`)
    }

    private async setClipboard(step: WorkflowStep) {
        const text = this.resolveVars(String(step.params.text))
        await this.evalJs(`navigator.clipboard.writeText(${JSON.stringify(text)}).catch(() => {})`)
        this.log('info', `Set clipboard: "${text.slice(0, 50)}"`)
    }

    // ============ Advanced ============

    private async get2fa(step: WorkflowStep) {
        const secretKey = this.resolveVars(step.params.secretKey)
        const saveAs = String(step.params.saveAs || 'code2fa')
        // Use a simple TOTP implementation via JS in browser
        const code = await this.evalJs(`
            (async function() {
                function base32Decode(s) {
                    const a = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
                    let bits = '', bytes = [];
                    s = s.toUpperCase().replace(/[^A-Z2-7]/g, '');
                    for (let i = 0; i < s.length; i++) bits += a.indexOf(s[i]).toString(2).padStart(5, '0');
                    for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(parseInt(bits.substr(i, 8), 2));
                    return new Uint8Array(bytes);
                }
                async function hmacSha1(key, data) {
                    const cryptoKey = await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']);
                    const sig = await crypto.subtle.sign('HMAC', cryptoKey, data);
                    return new Uint8Array(sig);
                }
                const secret = base32Decode(${JSON.stringify(secretKey)});
                const time = Math.floor(Date.now() / 30000);
                const timeBuffer = new ArrayBuffer(8);
                new DataView(timeBuffer).setUint32(4, time, false);
                const hmac = await hmacSha1(secret, new Uint8Array(timeBuffer));
                const offset = hmac[hmac.length - 1] & 0x0f;
                const code = ((hmac[offset] & 0x7f) << 24 | hmac[offset+1] << 16 | hmac[offset+2] << 8 | hmac[offset+3]) % 1000000;
                return code.toString().padStart(6, '0');
            })()
        `)
        this.variables[saveAs] = String(code)
        this.log('info', `Generated 2FA code → $${saveAs}`)
    }

    private async cookieImport(step: WorkflowStep) {
        const cookiesStr = this.resolveVars(String(step.params.cookies))
        try {
            const cookies = JSON.parse(cookiesStr)
            if (Array.isArray(cookies)) {
                for (const cookie of cookies) {
                    await this.client.Network.setCookie(cookie)
                }
                this.log('info', `Imported ${cookies.length} cookies`)
            } else {
                this.log('warning', 'Cookie data is not an array')
            }
        } catch {
            this.log('warning', 'Failed to parse cookie JSON')
        }
    }

    private async cookieExport(step: WorkflowStep) {
        const saveAs = String(step.params.saveAs || 'cookies')
        const cookies = await this.client.Network.getAllCookies()
        this.variables[saveAs] = JSON.stringify(cookies.cookies)
        this.log('info', `Exported ${cookies.cookies.length} cookies → $${saveAs}`)
    }

    private async readMailOtp(step: WorkflowStep) {
        this.log('warning', 'Read Mail OTP requires IMAP library - use agent with imap-simple for full support')
        const saveAs = String(step.params.saveAs || 'otpCode')
        this.variables[saveAs] = ''
    }

    private async aiGenerate(step: WorkflowStep) {
        const prompt = this.resolveVars(String(step.params.prompt))
        const model = String(step.params.model || 'gpt-3.5-turbo')
        const apiKey = this.resolveVars(String(step.params.apiKey))
        const saveAs = String(step.params.saveAs || 'aiResponse')

        if (!apiKey) {
            this.log('warning', 'AI Generate requires an OpenAI API key')
            this.variables[saveAs] = ''
            return
        }

        const fetchCode = `
            fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + ${JSON.stringify(apiKey)} },
                body: JSON.stringify({
                    model: ${JSON.stringify(model)},
                    messages: [{ role: 'user', content: ${JSON.stringify(prompt)} }],
                    max_tokens: 500
                })
            }).then(r => r.json()).then(d => d.choices?.[0]?.message?.content || '').catch(e => 'Error: ' + e.message)
        `
        const result = await this.evalJs(fetchCode)
        this.variables[saveAs] = String(result)
        this.log('info', `AI response: "${String(result).slice(0, 100)}" → $${saveAs}`)
    }

    private async switchToFrame(step: WorkflowStep) {
        const xpath = String(step.params.xpath)
        await this.evalJs(`
            (function() {
                const el = document.evaluate(${JSON.stringify(this.resolveVars(xpath))}, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
                if (el && el.contentDocument) return true;
                return false;
            })()
        `)
        this.log('info', `Switched to frame: ${xpath}`)
    }

    private async switchToDefault() {
        this.log('info', 'Switched to default frame')
    }

    private async switchToPopup(step: WorkflowStep) {
        const targets = await this.client.Target.getTargets()
        const title = this.resolveVars(step.params.title)
        const popup = targets.targetInfos?.find((t: any) =>
            t.type === 'page' && t.title.includes(title)
        )
        if (popup) {
            this.log('info', `Found popup: ${popup.title}`)
        } else {
            this.log('warning', `Popup not found with title: ${title}`)
        }
    }
}
