'use client'

import React, { useEffect, useRef, useState, useCallback } from 'react'
import {
    AlertCircle, Loader2, PlayCircle, StopCircle, RefreshCw,
    ChevronLeft, ChevronRight, RotateCcw, ZoomIn, ZoomOut,
    Maximize2, Minimize2, Smartphone, Monitor
} from 'lucide-react'

interface LiveViewerProps {
    profileId: string
    debuggerPort?: number | null
}

interface PageInfo {
    index: number
    title: string
    url: string
}

export default function LiveViewer({ profileId, debuggerPort }: LiveViewerProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const containerRef = useRef<HTMLDivElement>(null)
    const viewportRef = useRef<HTMLDivElement>(null)  // the scrollable viewport div
    const wsRef = useRef<WebSocket | null>(null)
    const [status, setStatus] = useState<'idle' | 'connecting' | 'connected' | 'error'>('idle')
    const [errorMsg, setErrorMsg] = useState<string>('')

    // Phase 2: URL + Tab state
    const [currentUrl, setCurrentUrl] = useState('')
    const [urlInput, setUrlInput] = useState('')
    const [pages, setPages] = useState<PageInfo[]>([])
    const [activePageIndex, setActivePageIndex] = useState(0)

    // Phase 3: Zoom + Fullscreen + Mobile
    const [zoom, setZoom] = useState(1.0)
    const [isFullscreen, setIsFullscreen] = useState(false)
    const [isMobile, setIsMobile] = useState(false)

    // Track remote scale metadata (deviceScaleFactor from screencast)
    const metadataRef = useRef({ deviceScaleFactor: 1, pageScaleFactor: 1 })

    // Get current viewport dimensions for screencast sizing
    const getViewportSize = useCallback(() => {
        const vp = viewportRef.current
        if (!vp) return { width: 1280, height: 900 }
        return { width: Math.floor(vp.clientWidth * zoom), height: Math.floor(vp.clientHeight * zoom) }
    }, [zoom])

    // ----------------------------------------------------------------
    // WebSocket helpers
    // ----------------------------------------------------------------
    const sendWs = useCallback((msg: any) => {
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify(msg))
        }
    }, [])

    // Notify server to resize screencast when zoom changes
    const sendResize = useCallback((w: number, h: number) => {
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({ type: 'resize', width: w, height: h }))
        }
    }, [])

    // ----------------------------------------------------------------
    // Canvas draw
    // ----------------------------------------------------------------
    const drawFrame = useCallback((base64Data: string) => {
        const canvas = canvasRef.current
        if (!canvas) return
        const ctx = canvas.getContext('2d')
        if (!ctx) return

        const img = new Image()
        img.onload = () => {
            if (canvas.width !== img.width || canvas.height !== img.height) {
                canvas.width = img.width
                canvas.height = img.height
            }
            ctx.drawImage(img, 0, 0)
        }
        img.src = `data:image/jpeg;base64,${base64Data}`
    }, [])

    // ----------------------------------------------------------------
    // Connect / Disconnect
    // ----------------------------------------------------------------
    const connect = useCallback(async () => {
        if (!debuggerPort) {
            setStatus('error')
            setErrorMsg('No remote debugging port found for this profile')
            return
        }
        try {
            setStatus('connecting')
            setErrorMsg('')

            // Init API to ensure WS Server is running
            await fetch('/api/live-view/init')

            const host = typeof window !== 'undefined' ? window.location.hostname : 'localhost'
            const { width, height } = getViewportSize()
            const wsUrl = `ws://${host}:3212/?profileId=${profileId}&debuggerPort=${debuggerPort}&width=${width}&height=${height}`
            const ws = new WebSocket(wsUrl)
            wsRef.current = ws

            ws.onopen = () => {
                console.log('[LiveViewer] Connected to WS')
            }

            ws.onmessage = (event) => {
                try {
                    const msg = JSON.parse(event.data)

                    if (msg.type === 'status') {
                        setStatus(msg.status)
                    } else if (msg.type === 'error') {
                        setStatus('error')
                        setErrorMsg(msg.message)
                    } else if (msg.type === 'frame' && msg.data) {
                        if (msg.metadata) {
                            metadataRef.current = msg.metadata
                        }
                        drawFrame(msg.data)
                    } else if (msg.type === 'urlChange') {
                        // Phase 2: update URL bar
                        setCurrentUrl(msg.url)
                        setUrlInput(msg.url)
                    } else if (msg.type === 'pageList') {
                        // Phase 2: update tab list
                        setPages(msg.pages || [])
                    }
                } catch (e) {
                    console.error('[LiveViewer] WS Message error:', e)
                }
            }

            ws.onerror = () => {
                setStatus('error')
                setErrorMsg('WebSocket connection error')
            }

            ws.onclose = () => {
                setStatus(prev => prev !== 'error' ? 'idle' : prev)
                wsRef.current = null
            }
        } catch (e: any) {
            setStatus('error')
            setErrorMsg(`Failed to connect: ${e.message}`)
        }
    }, [profileId, debuggerPort, drawFrame])

    const disconnect = useCallback(() => {
        if (wsRef.current) {
            wsRef.current.close()
            wsRef.current = null
        }
        setStatus('idle')
        setCurrentUrl('')
        setUrlInput('')
        setPages([])
        const canvas = canvasRef.current
        if (canvas) {
            const ctx = canvas.getContext('2d')
            if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height)
        }
    }, [])

    useEffect(() => {
        if (debuggerPort) connect()
        return () => disconnect()
    }, [debuggerPort, connect, disconnect])

    // ResizeObserver: khi container thay đổi kích thước, gửi resize lên server
    useEffect(() => {
        const vp = viewportRef.current
        if (!vp) return
        const observer = new ResizeObserver(() => {
            if (status === 'connected') {
                const { width, height } = getViewportSize()
                sendResize(width, height)
            }
        })
        observer.observe(vp)
        return () => observer.disconnect()
    }, [status, getViewportSize, sendResize])

    // Khi zoom thay đổi, cập nhật screencast
    useEffect(() => {
        if (status === 'connected') {
            const { width, height } = getViewportSize()
            sendResize(width, height)
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [zoom])
    useEffect(() => {
        const handlePaste = (e: ClipboardEvent) => {
            // Only intercept when canvas is focused
            if (document.activeElement !== canvasRef.current) return
            if (status !== 'connected') return
            const text = e.clipboardData?.getData('text/plain')
            if (text) {
                e.preventDefault()
                sendWs({ type: 'insertText', text })
            }
        }
        document.addEventListener('paste', handlePaste)
        return () => document.removeEventListener('paste', handlePaste)
    }, [status, sendWs])

    // ----------------------------------------------------------------
    // Phase 3: Fullscreen ESC key
    // ----------------------------------------------------------------
    useEffect(() => {
        const handleKeyEsc = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isFullscreen) {
                setIsFullscreen(false)
            }
        }
        document.addEventListener('keydown', handleKeyEsc)
        return () => document.removeEventListener('keydown', handleKeyEsc)
    }, [isFullscreen])

    // ----------------------------------------------------------------
    // Coordinate mapping — canvas pixel → Chrome viewport CSS px
    //
    // Screencast frame intrinsic size = viewportCssPixels * deviceScaleFactor
    // canvas.width/height = intrinsic size (physical pixels of the page)
    // rect (getBoundingClientRect) = CSS display size AFTER zoom transform
    //
    // Steps:
    //   1. Map clientX/Y → position within canvas rect → canvas intrinsic pixel
    //      scaleX = canvas.width / (rect.width / zoom) = map to unzoomed rect
    //   2. Divide by deviceScaleFactor → Chrome viewport CSS pixel
    // ----------------------------------------------------------------
    const getCanvasCoords = (e: React.MouseEvent | React.WheelEvent) => {
        const canvas = canvasRef.current
        if (!canvas) return { x: 0, y: 0 }

        const rect = canvas.getBoundingClientRect()
        // rect.width/height includes CSS zoom scale → remove zoom to get natural canvas display size
        const naturalWidth = rect.width / zoom
        const naturalHeight = rect.height / zoom

        // Map mouse position within natural (unzoomed) canvas display → canvas intrinsic pixels
        const scaleX = canvas.width / naturalWidth
        const scaleY = canvas.height / naturalHeight

        const canvasX = (e.clientX - rect.left) / zoom * scaleX
        const canvasY = (e.clientY - rect.top) / zoom * scaleY

        // canvas intrinsic pixels / deviceScaleFactor = Chrome viewport CSS pixels
        const dpr = metadataRef.current.deviceScaleFactor || 1
        return {
            x: Math.round(canvasX / dpr),
            y: Math.round(canvasY / dpr),
        }
    }

    const getModifiers = (e: React.MouseEvent | React.KeyboardEvent | React.WheelEvent) => {
        let mods = 0
        if (e.altKey) mods |= 1
        if (e.ctrlKey) mods |= 2
        if (e.metaKey) mods |= 4
        if (e.shiftKey) mods |= 8
        return mods
    }

    const getButton = (button: number) => {
        switch (button) {
            case 0: return 'left'
            case 1: return 'middle'
            case 2: return 'right'
            default: return 'none'
        }
    }

    // ----------------------------------------------------------------
    // Mouse Handlers
    // ----------------------------------------------------------------
    const handleMouseMove = (e: React.MouseEvent) => {
        if (status !== 'connected') return
        const { x, y } = getCanvasCoords(e)
        let button = 'none'
        if (e.buttons & 1) button = 'left'
        else if (e.buttons & 2) button = 'right'
        else if (e.buttons & 4) button = 'middle'
        sendWs({ type: 'mouseEvent', mouseType: 'mouseMoved', x, y, button, modifiers: getModifiers(e) })
    }

    const handleMouseDown = (e: React.MouseEvent) => {
        if (status !== 'connected') return
        // Phase 1 FIX: focus canvas immediately on mousedown
        canvasRef.current?.focus()
        const { x, y } = getCanvasCoords(e)
        sendWs({
            type: 'mouseEvent', mouseType: 'mousePressed',
            x, y, button: getButton(e.button),
            clickCount: e.detail || 1, modifiers: getModifiers(e)
        })
    }

    const handleMouseUp = (e: React.MouseEvent) => {
        if (status !== 'connected') return
        const { x, y } = getCanvasCoords(e)
        sendWs({
            type: 'mouseEvent', mouseType: 'mouseReleased',
            x, y, button: getButton(e.button),
            clickCount: e.detail || 1, modifiers: getModifiers(e)
        })
    }

    const handleWheel = (e: React.WheelEvent) => {
        if (status !== 'connected') return
        const { x, y } = getCanvasCoords(e)
        sendWs({
            type: 'mouseEvent', mouseType: 'mouseWheel',
            x, y, deltaX: e.deltaX, deltaY: e.deltaY, modifiers: getModifiers(e)
        })
    }

    // Phase 1 FIX: right-click sends contextMenu event to browser
    const handleContextMenu = (e: React.MouseEvent) => {
        e.preventDefault()
        if (status !== 'connected') return
        const { x, y } = getCanvasCoords(e)
        sendWs({ type: 'mouseEvent', mouseType: 'contextMenu', x, y, modifiers: getModifiers(e) })
    }

    // Phase 1 FIX: auto-focus on hover
    const handleMouseEnter = () => {
        if (status === 'connected') {
            canvasRef.current?.focus()
        }
    }

    // ----------------------------------------------------------------
    // Keyboard Handlers
    // ----------------------------------------------------------------
    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (status !== 'connected') return
        e.preventDefault()

        let text: string | undefined = e.key.length === 1 ? e.key : undefined
        if (e.key === 'Enter') text = '\r'
        if (e.key === 'Tab') text = '\t'

        sendWs({
            type: 'keyEvent', keyType: 'keyDown',
            modifiers: getModifiers(e),
            windowsVirtualKeyCode: e.keyCode,
            code: e.code, key: e.key,
            isSystemKey: e.altKey || e.ctrlKey || e.metaKey,
            autoRepeat: e.repeat,
        })

        // Send char event for printable characters
        if ((e.key.length === 1 || e.key === 'Enter' || e.key === 'Tab') && !e.ctrlKey && !e.metaKey && !e.altKey) {
            sendWs({
                type: 'keyEvent', keyType: 'char',
                modifiers: getModifiers(e), text, unmodifiedText: text
            })
        }
    }

    const handleKeyUp = (e: React.KeyboardEvent) => {
        if (status !== 'connected') return
        e.preventDefault()
        sendWs({
            type: 'keyEvent', keyType: 'keyUp',
            modifiers: getModifiers(e),
            windowsVirtualKeyCode: e.keyCode,
            code: e.code, key: e.key,
        })
    }

    // ----------------------------------------------------------------
    // Phase 2: Navigation helpers
    // ----------------------------------------------------------------
    const handleNavigate = (action: 'back' | 'forward' | 'reload') => {
        sendWs({ type: 'navigate', action })
    }

    const handleGoUrl = () => {
        if (!urlInput.trim()) return
        let url = urlInput.trim()
        if (!url.startsWith('http://') && !url.startsWith('https://')) {
            url = `https://${url}`
        }
        sendWs({ type: 'navigate', url })
        setUrlInput(url)
    }

    const handleSwitchPage = (index: number) => {
        setActivePageIndex(index)
        sendWs({ type: 'switchPage', pageIndex: index })
    }

    // Phase 3: Mobile emulation toggle
    const handleToggleMobile = () => {
        const newMobile = !isMobile
        setIsMobile(newMobile)
        sendWs({ type: 'emulate', mobile: newMobile })
    }

    // ----------------------------------------------------------------
    // Status indicator
    // ----------------------------------------------------------------
    const statusDot = status === 'connected'
        ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]'
        : status === 'connecting' ? 'bg-yellow-500 animate-pulse'
            : status === 'error' ? 'bg-red-500' : 'bg-gray-500'

    const statusLabel = status === 'connected' ? 'Live'
        : status === 'connecting' ? 'Connecting...'
            : status === 'error' ? 'Error' : 'Disconnected'

    // ----------------------------------------------------------------
    // Render
    // ----------------------------------------------------------------
    return (
        <div
            ref={containerRef}
            className={
                isFullscreen
                    ? 'fixed inset-0 z-50 flex flex-col bg-gray-950'
                    : 'flex flex-col h-full bg-gray-900 rounded-lg overflow-hidden border border-gray-800 shadow-xl'
            }
        >
            {/* ── Top Status Bar ── */}
            <div className="flex items-center justify-between px-3 py-1.5 bg-gray-950 border-b border-gray-800 text-gray-200 shrink-0">
                <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full shrink-0 ${statusDot}`} />
                    <span className="text-xs font-medium">{statusLabel}</span>
                </div>
                <div className="flex items-center gap-1">
                    {/* Mobile emulation toggle */}
                    {status === 'connected' && (
                        <button
                            onClick={handleToggleMobile}
                            title={isMobile ? 'Switch to Desktop' : 'Switch to Mobile'}
                            className={`p-1 rounded transition-colors ${isMobile ? 'text-blue-400 bg-blue-900/30' : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'}`}
                        >
                            {isMobile ? <Smartphone className="w-3.5 h-3.5" /> : <Monitor className="w-3.5 h-3.5" />}
                        </button>
                    )}
                    {/* Fullscreen */}
                    <button
                        onClick={() => setIsFullscreen(f => !f)}
                        title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
                        className="p-1 text-gray-400 hover:text-gray-200 hover:bg-gray-800 rounded transition-colors"
                    >
                        {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                    </button>
                    {/* Connect / Disconnect */}
                    {status === 'connected' ? (
                        <button
                            onClick={disconnect}
                            title="Disconnect"
                            className="p-1 text-gray-400 hover:text-red-400 hover:bg-gray-800 rounded transition-colors"
                        >
                            <StopCircle className="w-3.5 h-3.5" />
                        </button>
                    ) : (
                        <button
                            onClick={connect}
                            disabled={status === 'connecting'}
                            title="Connect"
                            className="p-1 text-gray-400 hover:text-green-400 hover:bg-gray-800 rounded transition-colors disabled:opacity-50"
                        >
                            {status === 'connecting' ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <PlayCircle className="w-3.5 h-3.5" />}
                        </button>
                    )}
                </div>
            </div>

            {/* ── Phase 2: Browser Toolbar ── */}
            {status === 'connected' && (
                <div className="flex items-center gap-1 px-2 py-1.5 bg-gray-800 border-b border-gray-700 shrink-0">
                    {/* Back / Forward / Reload */}
                    <button
                        onClick={() => handleNavigate('back')}
                        title="Back"
                        className="p-1 rounded text-gray-400 hover:text-white hover:bg-gray-700 transition-colors"
                    >
                        <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button
                        onClick={() => handleNavigate('forward')}
                        title="Forward"
                        className="p-1 rounded text-gray-400 hover:text-white hover:bg-gray-700 transition-colors"
                    >
                        <ChevronRight className="w-4 h-4" />
                    </button>
                    <button
                        onClick={() => handleNavigate('reload')}
                        title="Reload"
                        className="p-1 rounded text-gray-400 hover:text-white hover:bg-gray-700 transition-colors"
                    >
                        <RotateCcw className="w-3.5 h-3.5" />
                    </button>

                    {/* URL Bar */}
                    <input
                        type="text"
                        value={urlInput}
                        onChange={e => setUrlInput(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') handleGoUrl() }}
                        onFocus={() => canvasRef.current?.blur()}
                        placeholder="Enter URL..."
                        className="flex-1 bg-gray-900 border border-gray-600 text-gray-200 text-xs px-2.5 py-1 rounded-md focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 min-w-0"
                    />

                    {/* Tab Selector */}
                    {pages.length > 1 && (
                        <select
                            value={activePageIndex}
                            onChange={e => handleSwitchPage(Number(e.target.value))}
                            className="bg-gray-900 border border-gray-600 text-gray-200 text-xs px-2 py-1 rounded-md focus:outline-none focus:border-blue-500 max-w-[140px]"
                            title="Switch Tab"
                        >
                            {pages.map((p, i) => (
                                <option key={i} value={i}>
                                    [{i + 1}] {p.title || p.url.substring(0, 30) || `Tab ${i + 1}`}
                                </option>
                            ))}
                        </select>
                    )}

                    {/* Zoom Controls */}
                    <button
                        onClick={() => setZoom(z => Math.max(z - 0.1, 0.3))}
                        title="Zoom Out"
                        className="p-1 rounded text-gray-400 hover:text-white hover:bg-gray-700 transition-colors"
                    >
                        <ZoomOut className="w-3.5 h-3.5" />
                    </button>
                    <span className="text-xs text-gray-400 w-9 text-center shrink-0">
                        {Math.round(zoom * 100)}%
                    </span>
                    <button
                        onClick={() => setZoom(z => Math.min(z + 0.1, 2.5))}
                        title="Zoom In"
                        className="p-1 rounded text-gray-400 hover:text-white hover:bg-gray-700 transition-colors"
                    >
                        <ZoomIn className="w-3.5 h-3.5" />
                    </button>
                    <button
                        onClick={() => setZoom(1.0)}
                        title="Reset Zoom"
                        className="text-xs text-gray-500 hover:text-gray-300 px-1 transition-colors"
                    >
                        1:1
                    </button>
                </div>
            )}

            {/* ── Viewport ── */}
            <div className="relative flex-1 bg-black overflow-auto">
                {/* Overlays */}
                {status === 'connecting' && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900/80 backdrop-blur-sm z-10">
                        <Loader2 className="w-8 h-8 text-blue-500 animate-spin mb-4" />
                        <p className="text-sm text-gray-400 font-medium">Connecting to browser...</p>
                    </div>
                )}

                {status === 'error' && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900/90 z-10 p-6 text-center">
                        <AlertCircle className="w-10 h-10 text-red-500 mb-4" />
                        <p className="text-sm text-gray-300 font-medium mb-2">Connection Failed</p>
                        <p className="text-xs text-gray-500 max-w-sm">{errorMsg}</p>
                        <button
                            onClick={connect}
                            className="mt-6 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white text-sm font-medium rounded-md transition-colors"
                        >
                            Try Again
                        </button>
                    </div>
                )}

                {!debuggerPort && status !== 'error' && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900 z-10">
                        <p className="text-sm text-gray-400">Profile must be running to use Live View</p>
                    </div>
                )}

                {/* Canvas: fill container, natural size via CSS width */}
                <div
                    ref={viewportRef}
                    className="w-full h-full overflow-auto"
                    style={{ zoom: zoom !== 1 ? zoom : undefined }}
                >
                    <canvas
                        ref={canvasRef}
                        className={`block transition-opacity duration-300 ${status === 'connected' ? 'opacity-100' : 'opacity-0'}`}
                        style={{
                            width: '100%',
                            height: 'auto',
                            cursor: 'default',
                            display: 'block',
                        }}
                        tabIndex={0}
                        onContextMenu={handleContextMenu}
                        onMouseMove={handleMouseMove}
                        onMouseDown={handleMouseDown}
                        onMouseUp={handleMouseUp}
                        onWheel={handleWheel}
                        onMouseEnter={handleMouseEnter}
                        onKeyDown={handleKeyDown}
                        onKeyUp={handleKeyUp}
                    />
                </div>
            </div>
        </div>
    )
}
