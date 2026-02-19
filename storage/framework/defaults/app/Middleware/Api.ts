import { HttpError } from '@stacksjs/error-handling'
import { Middleware } from '@stacksjs/router'

/**
 * API Middleware
 *
 * Validates that the request includes a valid API key or meets
 * API-specific requirements (Accept header, rate limiting prefix, etc.).
 *
 * Usage:
 * route.group({ middleware: 'api' }, () => {
 *   route.get('/data', 'DataAction')
 * })
 */
export default new Middleware({
  name: 'api',
  priority: 1,

  async handle(request) {
    // Ensure the request accepts JSON
    const accept = request.headers.get('accept') || ''
    if (!accept.includes('application/json') && !accept.includes('*/*')) {
      throw new HttpError(406, 'This endpoint only serves JSON responses. Set Accept: application/json.')
    }
  },
})
