/**
 * Centralized environment configuration
 * All hardcoded URLs and env variables should be accessed through this module
 */

export const config = {
  gpmLogin: {
    apiUrl: process.env.GPMLOGIN_API_URL || 'http://127.0.0.1:19995',
    apiVersion: process.env.GPMLOGIN_API_VERSION || 'v3',
  },

  autoReg: {
    baseUrl: process.env.AUTO_REG_URL || 'http://127.0.0.1:8000',
  },

  agent: {
    url: process.env.LOCAL_AGENT_URL || '',
    secret: process.env.AGENT_SECRET || '',
  },

  app: {
    url: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
    isProduction: process.env.NODE_ENV === 'production',
    isVercel: !!process.env.VERCEL,
  },

  db: {
    url: process.env.DATABASE_URL || '',
  },
} as const
