import { NextRequest } from 'next/server'
import { logEmitter } from '@/lib/log-emitter'

export const dynamic = 'force-dynamic'

/**
 * GET /api/logs/stream - SSE Stream for real-time logs
 */
export async function GET(req: NextRequest) {
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    start(controller) {
      // Send initial keep-alive
      controller.enqueue(encoder.encode(': connected\n\n'))

      // Listener for new logs
      const onLog = (log: any) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(log)}\n\n`))
      }

      logEmitter.on('new-log', onLog)

      // Handle close
      req.signal.addEventListener('abort', () => {
        logEmitter.off('new-log', onLog)
        controller.close()
      })
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  })
}
