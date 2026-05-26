import { NextRequest, NextResponse } from 'next/server'
import { BrowserConnectionService } from '@/core/services/BrowserConnectionService'

const browserConnectionService = new BrowserConnectionService()

/**
 * PATCH /api/browser-connections/:id - Update browser connection
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json()
    const { name, apiUrl, apiVersion, providerType, description, isEnabled, isDefault } = body

    if (apiUrl !== undefined && !String(apiUrl).trim()) {
      return NextResponse.json({ success: false, error: 'API URL không được để trống' }, { status: 400 })
    }
    if (name !== undefined && !String(name).trim()) {
      return NextResponse.json({ success: false, error: 'Tên kết nối không được để trống' }, { status: 400 })
    }

    const connection = await browserConnectionService.update(params.id, {
      name,
      apiUrl,
      apiVersion,
      providerType,
      description,
      isEnabled,
      isDefault,
    })

    return NextResponse.json({ success: true, connection })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    const status = message.includes('không tồn tại') ? 404 : 500
    return NextResponse.json({ success: false, error: message }, { status })
  }
}

/**
 * DELETE /api/browser-connections/:id - Delete browser connection
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    if (browserConnectionService.isBuiltin(params.id)) {
      return NextResponse.json(
        { success: false, error: 'Không thể xóa kết nối mặc định (GPMLogin Local/Global). Chỉ có thể chỉnh sửa URL.' },
        { status: 400 }
      )
    }

    await browserConnectionService.delete(params.id)
    return NextResponse.json({ success: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    const status = message.includes('không tồn tại') ? 404 : message.includes('Không thể xóa') ? 400 : 500
    return NextResponse.json({ success: false, error: message }, { status })
  }
}
