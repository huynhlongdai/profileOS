/**
 * TOTP (Time-based One-Time Password) utility
 * For generating 2FA codes from secret keys
 */
import { authenticator } from 'otplib'

/**
 * Generate TOTP code from secret key
 * @param secret - Base32 encoded secret key
 * @returns 6-digit TOTP code
 */
export function generateTOTP(secret: string): string {
  if (!secret || secret.trim() === '') {
    throw new Error('Secret key is required')
  }

  // Clean secret (remove spaces, convert to uppercase)
  const cleanSecret = secret.trim().replace(/\s+/g, '').toUpperCase()

  try {
    return authenticator.generate(cleanSecret)
  } catch (error) {
    throw new Error(`Failed to generate TOTP: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * Validate TOTP code
 * @param secret - Base32 encoded secret key
 * @param token - TOTP code to validate
 * @returns true if valid, false otherwise
 */
export function validateTOTP(secret: string, token: string): boolean {
  if (!secret || !token) {
    return false
  }

  const cleanSecret = secret.trim().replace(/\s+/g, '').toUpperCase()
  const cleanToken = token.trim()

  try {
    return authenticator.check(cleanToken, cleanSecret)
  } catch {
    return false
  }
}

