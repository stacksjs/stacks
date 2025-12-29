/**
 * Route Loader
 *
 * Loads routes from the route registry with automatic prefixing.
 * The key name becomes the URL prefix (except 'api' and 'web' which have no prefix).
 */

import type { RouteDefinition, RouteRegistry } from '../../../../../app/Routes'
import { route } from './stacks-router'

/** Keys that should not have a prefix (loaded at root /) */
const NO_PREFIX_KEYS = ['api', 'web']

/**
 * Load all routes from the registry
 */
export async function loadRoutes(registry: RouteRegistry): Promise<void> {
  for (const [key, definition] of Object.entries(registry)) {
    const config = normalizeDefinition(definition)
    // Use explicit prefix if provided, otherwise derive from key (unless it's a no-prefix key)
    const prefix = config.prefix !== undefined
      ? config.prefix || undefined  // Allow empty string to mean no prefix
      : (NO_PREFIX_KEYS.includes(key) ? undefined : `/${key}`)
    const middleware = normalizeMiddleware(config.middleware)

    try {
      if (prefix || middleware.length > 0) {
        await route.group({
          prefix,
          middleware: middleware.length > 0 ? middleware : undefined,
        }, async () => {
          await importRouteFile(config.path)
        })
      }
      else {
        await importRouteFile(config.path)
      }
    }
    catch (error) {
      console.error(`[Routes] Failed to load route file '${config.path}':`, error)
    }
  }
}

/**
 * Import a route file from the routes directory
 */
async function importRouteFile(path: string): Promise<void> {
  // Remove .ts extension if present
  const cleanPath = path.replace(/\.ts$/, '')
  await import(`../../../../../routes/${cleanPath}`)
}

/**
 * Normalize route definition to object form
 */
function normalizeDefinition(def: string | RouteDefinition): RouteDefinition {
  if (typeof def === 'string') {
    return { path: def }
  }
  return def
}

/**
 * Normalize middleware to array form
 */
function normalizeMiddleware(middleware: string | string[] | undefined): string[] {
  if (!middleware) return []
  if (typeof middleware === 'string') return [middleware]
  return middleware
}
