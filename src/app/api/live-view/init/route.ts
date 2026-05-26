import { NextResponse } from 'next/server'
import { LiveViewServerManager } from '@/lib/live-view/LiveViewServer'

export async function GET() {
    try {
        const manager = LiveViewServerManager.getInstance()
        manager.init()

        return NextResponse.json({
            success: true,
            message: 'LiveView WS Server is running',
            port: 3212
        })
    } catch (error: any) {
        console.error('Failed to init LiveView WS Server:', error)
        return NextResponse.json({
            success: false,
            message: error.message
        }, { status: 500 })
    }
}
