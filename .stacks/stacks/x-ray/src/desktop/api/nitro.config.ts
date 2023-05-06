// nitro.config.ts
import { defineNitroConfig } from 'nitropack'

export default defineNitroConfig({
  storage: {
    redis: {
      driver: 'redis',
      /* redis connector options */
    },
    db: {
      driver: 'fs',
      base: './data/db',
    },
  },

  routeRules: {
    '/api/**': { cors: true, headers: { 'access-control-allowed-methods': '*', 'access-allowed-origins': '*', 'access-control-allowed-headers': 'Origin, Content-Type, X-Auth-Token' } },
  },
})
