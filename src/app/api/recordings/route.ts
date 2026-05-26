/**
 * API Routes for Action Recordings
 * 
 * GET /api/recordings - List all recordings
 * POST /api/recordings - Create new recording
 */

import { NextRequest, NextResponse } from 'next/server'
import { ActionRecordingService } from '@/core/services/ActionRecordingService'

const recordingService = new ActionRecordingService()

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams

    const filters = {
      accountType: searchParams.get('accountType') || undefined,
      status: (searchParams.get('status') as 'draft' | 'published' | 'archived') || undefined,
      search: searchParams.get('search') || undefined,
      limit: searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 50,
      offset: searchParams.get('offset') ? parseInt(searchParams.get('offset')!) : 0,
    }

    const result = await recordingService.listRecordings(filters)

    return NextResponse.json(result, { status: 200 })
  } catch (error) {
    console.error('[API] Error listing recordings:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to list recordings' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Validate required fields
    if (!body.name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    }

    if (!body.actions || !Array.isArray(body.actions)) {
      return NextResponse.json({ error: 'Actions array is required' }, { status: 400 })
    }

    const recording = await recordingService.createRecording({
      name: body.name,
      description: body.description,
      accountType: body.accountType,
      url: body.url,
      version: body.version,
      author: body.author,
      tags: body.tags,
      actions: body.actions,
      config: body.config,
    })

    return NextResponse.json(recording, { status: 201 })
  } catch (error) {
    console.error('[API] Error creating recording:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create recording' },
      { status: 500 }
    )
  }
}

