import { response, route } from '@stacksjs/router'

/**
 * API v1 Routes
 *
 * All routes here are prefixed with /v1
 */

route.get('/status', () => response.json({ version: 'v1', status: 'ok' }))

// Add your v1 routes here
