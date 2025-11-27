// Simple health check action that doesn't require @stacksjs/actions
// This overrides the default framework health check

import { route } from '@stacksjs/router'

export default {
  name: 'Health',
  description: 'Health check for ECS',
  path: '/health',

  async handle() {
    return {
      status: 'ok',
      timestamp: Date.now(),
    }
  },
}

// Also register as a route for redundancy
route.get('/health', () => {
  return { status: 'ok', timestamp: Date.now() }
})
