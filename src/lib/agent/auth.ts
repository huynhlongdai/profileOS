import { NextRequest } from 'next/server'
import { config } from '@/lib/config'

/**
 * Validate agent request authentication
 * Agent must send Bearer token matching AGENT_SECRET env variable
 */
export function validateAgentAuth(req: NextRequest): boolean {
  const secret = config.agent.secret
  if (!secret) return false

  const authHeader = req.headers.get('authorization')
  if (!authHeader) return false

  const token = authHeader.replace('Bearer ', '')
  return token === secret
}
