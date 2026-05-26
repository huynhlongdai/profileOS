import { NextRequest, NextResponse } from 'next/server'

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const taskId = params.id
  const baseUrl = process.env.AUTO_REG_URL || 'http://localhost:8000'
  
  try {
    // Forward the request to the auto_reg SSE endpoint
    const response = await fetch(`${baseUrl}/api/tasks/${taskId}/logs/stream`)
    
    if (!response.ok) {
      return NextResponse.json(
        { success: false, error: 'Failed to connect to log stream' },
        { status: response.status }
      )
    }

    // Return the response as a stream
    return new NextResponse(response.body, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    )
  }
}
