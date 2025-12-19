/**
 * @stacksjs/router - Stacks Router
 *
 * A thin wrapper around bun-router that adds Stacks-specific
 * action/controller resolution for string-based route handlers.
 *
 * All routing functionality comes directly from bun-router.
 */

// Re-export everything from bun-router (includes response factory)
export * from 'bun-router'

// Export Stacks-specific action resolver
export { createStacksRouter, route, serve } from './stacks-router'

// Export request context helpers
export { getCurrentRequest, request, runWithRequest, setCurrentRequest } from './request-context'
