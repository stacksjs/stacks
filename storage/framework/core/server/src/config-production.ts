/**
 * Production server config - minimal, no runtime file loading
 * This config is inlined at build time for compiled binaries
 */

export const config = {
  app: {
    name: process.env.APP_NAME || 'Stacks',
    env: process.env.APP_ENV || 'production',
    debug: process.env.APP_DEBUG === 'true' || false,
    url: process.env.APP_URL || 'https://stacksjs.com',
  },
  server: {
    port: Number(process.env.PORT) || 3000,
    host: '0.0.0.0',
  },
  logging: {
    level: process.env.LOG_LEVEL || 'info',
  },
}

export default config
