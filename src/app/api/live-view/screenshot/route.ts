import { NextRequest, NextResponse } from 'next/server'
import { chromium } from 'playwright'

/**
 * GET /api/live-view/screenshot?port=9222
 * Quick screenshot without needing a full WS screencast session.
 * Returns base64 JPEG image.
 */
export async function GET(request: NextRequest) {
    const port = request.nextUrl.searchParams.get('port')

    if (!port) {
        return NextResponse.json({ success: false, error: 'Missing port parameter' }, { status: 400 })
    }

    let browser: any = null
    try {
        const browserUrl = `http://127.0.0.1:${port}`

        // Connect via Playwright CDP
        browser = await chromium.connectOverCDP(browserUrl)
        const contexts = browser.contexts()
        if (contexts.length === 0) throw new Error('No browser contexts found')

        const pages = contexts[0].pages()
        if (pages.length === 0) throw new Error('No pages found')

        const page = pages[pages.length - 1]

        // Capture screenshot
        const screenshotBuffer = await page.screenshot({ type: 'jpeg', quality: 80 })
        const base64 = screenshotBuffer.toString('base64')
        const pageUrl = page.url()
        const title = await page.title()

        // Disconnect but don't close the actual browser
        await browser.close()
        browser = null

        return NextResponse.json({
            success: true,
            image: base64,
            url: pageUrl,
            title,
        })
    } catch (error: any) {
        console.error('[LiveView Screenshot] Error:', error)
        if (browser) {
            try { await browser.close() } catch { }
        }
        return NextResponse.json(
            { success: false, error: error.message || 'Screenshot failed' },
            { status: 500 }
        )
    }
}
