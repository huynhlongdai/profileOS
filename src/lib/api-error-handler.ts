import { NextResponse } from 'next/server'

/**
 * Standardized API error handler
 */
export function handleApiError(error: unknown, defaultMessage = 'An error occurred') {
  console.error('API Error:', error)

  const message = error instanceof Error ? error.message : String(error)
  const statusCode = error instanceof Error && 'statusCode' in error 
    ? (error as any).statusCode 
    : 500

  return NextResponse.json(
    {
      success: false,
      error: message || defaultMessage,
    },
    { status: statusCode }
  )
}

/**
 * Success response helper
 */
export function successResponse(data: any, statusCode = 200) {
  return NextResponse.json(
    {
      success: true,
      ...data,
    },
    { status: statusCode }
  )
}

