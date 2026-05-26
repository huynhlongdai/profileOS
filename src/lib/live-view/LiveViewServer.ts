/**
 * LiveViewServer.ts — Raw CDP WebSocket approach
 *
 * Thay vì dùng Playwright's page.mouse/keyboard (gây state conflict) hay CDPSession
 * (phụ thuộc Playwright's internal routing), ta kết nối TRỰC TIẾP đến Chrome DevTools
 * WebSocket của từng tab qua HTTP /json rồi dùng raw ws để gửi CDP commands.
 *
 * Architecture:
 *   Browser[Next.js] --WS:3212--> LiveViewServer --WS:CDP--> Chrome(port 9222)
 */

import { WebSocketServer, WebSocket } from 'ws'
import http from 'http'

// ── Global singleton để tránh khởi động lại port khi HMR ──────────────────
declare global {
    var __liveViewWss: WebSocketServer | undefined
}

// ── Types ─────────────────────────────────────────────────────────────────
interface ChromeTarget {
    id: string
    title: string
    url: string
    type: string
    webSocketDebuggerUrl: string
}

interface Session {
    chromeWs: WebSocket          // raw WS đến Chrome DevTools
    chromePort: string
    targets: ChromeTarget[]      // danh sách tabs
    activeTargetId: string       // tab hiện tại
    cmdId: number                // CDP command ID counter
    screencastSessionId: number | null
    viewportWidth: number        // kích thước viewport do client gửi
    viewportHeight: number
}

// ── Main manager ──────────────────────────────────────────────────────────
export class LiveViewServerManager {
    private static _instance: LiveViewServerManager
    private wss: WebSocketServer | null = null
    private readonly WS_PORT = 3212

    // per-client sessions: clientSessionKey → Session
    private sessions = new Map<string, Session>()

    private constructor() { }

    static getInstance(): LiveViewServerManager {
        if (!LiveViewServerManager._instance) {
            LiveViewServerManager._instance = new LiveViewServerManager()
        }
        return LiveViewServerManager._instance
    }

    // ── init ────────────────────────────────────────────────────────────
    init() {
        if (global.__liveViewWss) {
            // Server đã chạy — chỉ cần gắn lại instance reference
            this.wss = global.__liveViewWss
            // Xóa listener cũ rồi gắn mới (fix HMR bug)
            this.wss.removeAllListeners('connection')
            this.wss.on('connection', (ws, req) => this.handleClientConnection(ws, req))
            console.log('[LiveView] Reused existing WS server, updated connection handler')
            return
        }

        try {
            this.wss = new WebSocketServer({ port: this.WS_PORT })
            global.__liveViewWss = this.wss
            this.wss.on('connection', (ws, req) => this.handleClientConnection(ws, req))
            this.wss.on('error', (e) => console.error('[LiveView] WS server error:', e))
            console.log(`[LiveView] WS server started on ws://localhost:${this.WS_PORT}`)
        } catch (e) {
            console.error('[LiveView] Failed to start WS server:', e)
        }
    }

    // ── Fetch Chrome targets via HTTP /json ──────────────────────────────
    private fetchTargets(chromePort: string): Promise<ChromeTarget[]> {
        return new Promise((resolve, reject) => {
            const req = http.get(`http://127.0.0.1:${chromePort}/json`, (res) => {
                let data = ''
                res.on('data', (chunk) => data += chunk)
                res.on('end', () => {
                    try {
                        const targets: ChromeTarget[] = JSON.parse(data)
                        // Chỉ lấy tab page (loại bỏ extensions, service workers...)
                        resolve(targets.filter(t => t.type === 'page'))
                    } catch (e) {
                        reject(new Error('Failed to parse Chrome targets: ' + e))
                    }
                })
            })
            req.on('error', reject)
            req.setTimeout(5000, () => { req.destroy(); reject(new Error('Timeout fetching Chrome targets')) })
        })
    }

    // ── Connect raw WebSocket to a Chrome tab ────────────────────────────
    private connectToChromeTab(targetWsUrl: string): Promise<WebSocket> {
        return new Promise((resolve, reject) => {
            const ws = new WebSocket(targetWsUrl)
            ws.once('open', () => resolve(ws))
            ws.once('error', (e) => reject(e))
            setTimeout(() => reject(new Error('Timeout connecting to Chrome tab')), 8000)
        })
    }

    // ── Send CDP command via raw Chrome WS ──────────────────────────────
    private cdpSend(session: Session, method: string, params: any = {}): number {
        const id = ++session.cmdId
        if (session.chromeWs.readyState === WebSocket.OPEN) {
            session.chromeWs.send(JSON.stringify({ id, method, params }))
        }
        return id
    }

    // ── Helper: send JSON to frontend browser client ─────────────────────
    private clientSend(clientWs: WebSocket, data: any) {
        if (clientWs.readyState === WebSocket.OPEN) {
            clientWs.send(JSON.stringify(data))
        }
    }

    // ── Start screencast on active tab (với maxWidth/maxHeight theo viewport) ────
    private startScreencast(session: Session) {
        // Set viewport đúng kích thước container của client
        if (session.viewportWidth > 0 && session.viewportHeight > 0) {
            this.cdpSend(session, 'Emulation.setDeviceMetricsOverride', {
                width:  session.viewportWidth,
                height: session.viewportHeight,
                deviceScaleFactor: 1,
                mobile: false,
            })
        }
        this.cdpSend(session, 'Page.startScreencast', {
            format: 'jpeg',
            quality: 80,
            everyNthFrame: 1,
            ...(session.viewportWidth > 0 ? { maxWidth: session.viewportWidth, maxHeight: session.viewportHeight } : {}),
        })
    }

    // ── Stop screencast ──────────────────────────────────────────────────
    private stopScreencast(session: Session) {
        this.cdpSend(session, 'Page.stopScreencast', {})
    }

    // ── Switch active tab ────────────────────────────────────────────────
    private async switchTab(session: Session, targetId: string, clientWs: WebSocket) {
        if (!session.targets.find(t => t.id === targetId)) return

        // Stop current screencast
        this.stopScreencast(session)

        // Activate target in Chrome
        this.cdpSend(session, 'Target.activateTarget', { targetId })

        // Close old chromeWs
        session.chromeWs.removeAllListeners()
        session.chromeWs.close()

        // Fetch fresh targets to get wsUrl of new tab
        const targets = await this.fetchTargets(session.chromePort)
        const target = targets.find(t => t.id === targetId)
        if (!target?.webSocketDebuggerUrl) return

        // Connect to new tab
        const newChromeWs = await this.connectToChromeTab(target.webSocketDebuggerUrl)
        session.chromeWs = newChromeWs
        session.activeTargetId = targetId
        session.targets = targets

        // Re-attach Chrome WS message handler
        this.attachChromeWsHandlers(session, clientWs)

        // Start screencast on new tab
        this.startScreencast(session)

        // Push updated info to client
        this.clientSend(clientWs, { type: 'urlChange', url: target.url })
        this.clientSend(clientWs, {
            type: 'pageList',
            pages: targets.map((t, i) => ({ index: i, id: t.id, title: t.title, url: t.url }))
        })
    }

    // ── Attach Chrome WS message → forward to client ─────────────────────
    private attachChromeWsHandlers(session: Session, clientWs: WebSocket) {
        session.chromeWs.on('message', (data: Buffer) => {
            try {
                const msg = JSON.parse(data.toString())

                // Screencast frame
                if (msg.method === 'Page.screencastFrame') {
                    const params = msg.params
                    // Ack frame immediately
                    this.cdpSend(session, 'Page.screencastFrameAck', { sessionId: params.sessionId })
                    // Forward to client
                    this.clientSend(clientWs, {
                        type: 'frame',
                        data: params.data,
                        metadata: params.metadata,
                    })
                }

                // Frame navigation (URL changed)
                else if (msg.method === 'Page.frameNavigated') {
                    const frame = msg.params?.frame
                    if (frame && !frame.parentId) { // only main frame
                        this.clientSend(clientWs, { type: 'urlChange', url: frame.url })
                    }
                }

                // Target created (new tab / popup)
                else if (msg.method === 'Target.targetCreated' || msg.method === 'Target.targetInfoChanged') {
                    // Refresh tab list
                    this.fetchTargets(session.chromePort).then(targets => {
                        session.targets = targets
                        this.clientSend(clientWs, {
                            type: 'pageList',
                            pages: targets.map((t, i) => ({ index: i, id: t.id, title: t.title, url: t.url }))
                        })
                    }).catch(() => { })
                }

            } catch (e) {
                // Non-JSON or ignored
            }
        })

        session.chromeWs.on('error', (e) => {
            console.error('[LiveView] Chrome WS error:', e)
        })

        session.chromeWs.on('close', () => {
            console.log('[LiveView] Chrome WS closed')
            this.clientSend(clientWs, { type: 'error', message: 'Chrome connection closed' })
        })
    }

    // ── Main: handle new frontend client connection ───────────────────────
    private async handleClientConnection(clientWs: WebSocket, req: any) {
        const urlObj = new URL(req.url, `http://localhost:${this.WS_PORT}`)
        const profileId = urlObj.searchParams.get('profileId')
        const debuggerPort = urlObj.searchParams.get('debuggerPort')
        const viewportWidth  = parseInt(urlObj.searchParams.get('width')  || '0') || 0
        const viewportHeight = parseInt(urlObj.searchParams.get('height') || '0') || 0

        console.log(`[LiveView] Client connected: profileId=${profileId}, port=${debuggerPort}, viewport=${viewportWidth}x${viewportHeight}`)

        if (!profileId || !debuggerPort) {
            this.clientSend(clientWs, { type: 'error', message: 'Missing profileId or debuggerPort' })
            clientWs.close()
            return
        }

        const sessionKey = `${profileId}-${Date.now()}`

        try {
            this.clientSend(clientWs, { type: 'status', status: 'connecting' })

            // 1. Fetch available tabs
            const targets = await this.fetchTargets(debuggerPort)
            if (targets.length === 0) throw new Error('No page tabs found in Chrome. Make sure the profile is running.')

            // Pick the last tab (most recently active)
            const activeTarget = targets[targets.length - 1]

            console.log(`[LiveView] Connecting to tab: ${activeTarget.title} (${activeTarget.url})`)
            console.log(`[LiveView] Chrome WS URL: ${activeTarget.webSocketDebuggerUrl}`)

            // 2. Connect raw WebSocket to that tab
            const chromeWs = await this.connectToChromeTab(activeTarget.webSocketDebuggerUrl)

            // 3. Build session
            const session: Session = {
                chromeWs,
                chromePort: debuggerPort,
                targets,
                activeTargetId: activeTarget.id,
                cmdId: 0,
                screencastSessionId: null,
                viewportWidth,
                viewportHeight,
            }
            this.sessions.set(sessionKey, session)

            // 4. Attach Chrome WS handlers
            this.attachChromeWsHandlers(session, clientWs)

            // 5. Enable necessary CDP domains
            this.cdpSend(session, 'Page.enable')
            this.cdpSend(session, 'Runtime.enable')

            // 6. Start screencast
            this.startScreencast(session)

            // 7. Notify client: connected
            this.clientSend(clientWs, { type: 'status', status: 'connected' })
            this.clientSend(clientWs, { type: 'urlChange', url: activeTarget.url })
            this.clientSend(clientWs, {
                type: 'pageList',
                pages: targets.map((t, i) => ({ index: i, id: t.id, title: t.title, url: t.url }))
            })

            // 8. Handle commands from frontend
            clientWs.on('message', async (data: Buffer) => {
                try {
                    const msg = JSON.parse(data.toString())
                    const s = this.sessions.get(sessionKey)
                    if (!s) return

                    switch (msg.type) {
                        // ─────────────────────────────────────────────────
                        // Mouse Events — Raw CDP Input.dispatchMouseEvent
                        // ─────────────────────────────────────────────────
                        case 'mouseEvent': {
                            const { mouseType, x, y, button = 'none', clickCount = 1, modifiers = 0, deltaX = 0, deltaY = 0 } = msg

                            if (mouseType === 'mouseMoved') {
                                this.cdpSend(s, 'Input.dispatchMouseEvent', {
                                    type: 'mouseMoved', x, y, modifiers,
                                    button: 'none', buttons: 0,
                                })
                            } else if (mouseType === 'mousePressed') {
                                this.cdpSend(s, 'Input.dispatchMouseEvent', {
                                    type: 'mousePressed', x, y, modifiers,
                                    button: button === 'none' ? 'left' : button,
                                    clickCount,
                                })
                            } else if (mouseType === 'mouseReleased') {
                                this.cdpSend(s, 'Input.dispatchMouseEvent', {
                                    type: 'mouseReleased', x, y, modifiers,
                                    button: button === 'none' ? 'left' : button,
                                    clickCount,
                                })
                            } else if (mouseType === 'mouseWheel') {
                                this.cdpSend(s, 'Input.dispatchMouseEvent', {
                                    type: 'mouseWheel', x, y, modifiers,
                                    deltaX, deltaY,
                                })
                            } else if (mouseType === 'contextMenu') {
                                // Right click: press + release với button='right'
                                this.cdpSend(s, 'Input.dispatchMouseEvent', {
                                    type: 'mousePressed', x, y, modifiers,
                                    button: 'right', clickCount: 1,
                                })
                                this.cdpSend(s, 'Input.dispatchMouseEvent', {
                                    type: 'mouseReleased', x, y, modifiers,
                                    button: 'right', clickCount: 1,
                                })
                            }
                            break
                        }

                        // ─────────────────────────────────────────────────
                        // Keyboard Events — Raw CDP Input.dispatchKeyEvent
                        // ─────────────────────────────────────────────────
                        case 'keyEvent': {
                            const { keyType, key, code, modifiers = 0, windowsVirtualKeyCode = 0, text, isSystemKey = false, autoRepeat = false } = msg

                            if (keyType === 'keyDown') {
                                this.cdpSend(s, 'Input.dispatchKeyEvent', {
                                    type: 'rawKeyDown',
                                    key, code, modifiers,
                                    windowsVirtualKeyCode,
                                    nativeVirtualKeyCode: windowsVirtualKeyCode,
                                    isSystemKey, autoRepeat,
                                })
                            } else if (keyType === 'char' && text) {
                                this.cdpSend(s, 'Input.dispatchKeyEvent', {
                                    type: 'char',
                                    key, modifiers, text,
                                    unmodifiedText: text,
                                })
                            } else if (keyType === 'keyUp') {
                                this.cdpSend(s, 'Input.dispatchKeyEvent', {
                                    type: 'keyUp',
                                    key, code, modifiers,
                                    windowsVirtualKeyCode,
                                    nativeVirtualKeyCode: windowsVirtualKeyCode,
                                })
                            }
                            break
                        }

                        // ─────────────────────────────────────────────────
                        // Insert Text (clipboard paste)
                        // ─────────────────────────────────────────────────
                        case 'insertText': {
                            if (msg.text) {
                                this.cdpSend(s, 'Input.insertText', { text: msg.text })
                            }
                            break
                        }

                        // ─────────────────────────────────────────────────
                        // Navigation
                        // ─────────────────────────────────────────────────
                        case 'navigate': {
                            if (msg.action === 'back') {
                                this.cdpSend(s, 'Runtime.evaluate', {
                                    expression: 'window.history.back()', silent: true
                                })
                            } else if (msg.action === 'forward') {
                                this.cdpSend(s, 'Runtime.evaluate', {
                                    expression: 'window.history.forward()', silent: true
                                })
                            } else if (msg.action === 'reload') {
                                this.cdpSend(s, 'Page.reload', {})
                            } else if (msg.url) {
                                this.cdpSend(s, 'Page.navigate', { url: msg.url })
                            }
                            break
                        }

                        // ─────────────────────────────────────────────────
                        // Switch Tab
                        // ─────────────────────────────────────────────────
                        case 'switchPage': {
                            const target = s.targets[msg.pageIndex]
                            if (target) {
                                await this.switchTab(s, target.id, clientWs)
                            }
                            break
                        }

                        // ─────────────────────────────────────────────────
                        // Mobile Emulation
                        // ─────────────────────────────────────────────────
                        case 'emulate': {
                            if (msg.mobile) {
                                this.cdpSend(s, 'Emulation.setDeviceMetricsOverride', {
                                    width: msg.width || 390,
                                    height: msg.height || 844,
                                    deviceScaleFactor: msg.deviceScaleFactor || 3,
                                    mobile: true,
                                })
                            } else {
                                this.cdpSend(s, 'Emulation.clearDeviceMetricsOverride', {})
                            }
                            break
                        }

                        // ─────────────────────────────────────────────────
                        // Resize screencast viewport (container resized / zoom changed)
                        // ─────────────────────────────────────────────────
                        case 'resize': {
                            const w = Math.max(320, Math.min(3840, msg.width || 1280))
                            const h = Math.max(240, Math.min(2160, msg.height || 900))
                            s.viewportWidth = w
                            s.viewportHeight = h
                            // Stop old screencast & restart with new dimensions
                            this.stopScreencast(s)
                            this.startScreencast(s)
                            break
                        }
                    }
                } catch (e) {
                    console.error('[LiveView] Error processing client message:', e)
                }
            })

            clientWs.on('close', () => {
                console.log(`[LiveView] Client disconnected: ${profileId}`)
                const s = this.sessions.get(sessionKey)
                if (s) {
                    try { this.stopScreencast(s) } catch { }
                    try { s.chromeWs.close() } catch { }
                    this.sessions.delete(sessionKey)
                }
            })

            clientWs.on('error', () => {
                const s = this.sessions.get(sessionKey)
                if (s) { s.chromeWs.close(); this.sessions.delete(sessionKey) }
            })

        } catch (error: any) {
            console.error(`[LiveView] Connection failed for profile ${profileId}:`, error)
            this.clientSend(clientWs, { type: 'error', message: error.message })
            clientWs.close()
        }
    }
}
