/**
 * API Routes for individual Action Recording
 * 
 * GET /api/recordings/[id] - Get recording by ID
 * PUT /api/recordings/[id] - Update recording
 * DELETE /api/recordings/[id] - Delete recording
 */

import { NextRequest, NextResponse } from 'next/server'
import { ActionRecordingService } from '@/core/services/ActionRecordingService'

const recordingService = new ActionRecordingService()

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const recording = await recordingService.getRecordingById(params.id)

    if (!recording) {
      return NextResponse.json({ error: 'Recording not found' }, { status: 404 })
    }

    return NextResponse.json(recording, { status: 200 })
  } catch (error) {
    console.error('[API] Error getting recording:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to get recording' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json()

    const recording = await recordingService.updateRecording(params.id, {
      name: body.name,
      description: body.description,
      accountType: body.accountType,
      url: body.url,
      version: body.version,
      author: body.author,
      tags: body.tags,
      actions: body.actions,
      config: body.config,
      status: body.status,
    })

    return NextResponse.json(recording, { status: 200 })
  } catch (error) {
    console.error('[API] Error updating recording:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update recording' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await recordingService.deleteRecording(params.id)

    return NextResponse.json({ success: true }, { status: 200 })
  } catch (error) {
    console.error('[API] Error deleting recording:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete recording' },
      { status: 500 }
    )
  }
}

