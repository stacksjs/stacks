/**
 * Route Loader
 *
 * Loads routes from the route registry with automatic prefixing.
 * The key name becomes the URL prefix (except 'api' and 'web' which have no prefix).
 *
 * User routes are loaded FIRST so they always take priority over framework defaults.
 * When bun-router encounters a duplicate route (same method + path), the first
 * registration wins — so user-defined routes naturally override framework routes.
 */

import type { RouteDefinition, RouteRegistry } from '../../../../../app/Routes'
import { log } from '@stacksjs/logging'
import { route } from './stacks-router'

/** Keys that should not have a prefix (loaded at root /) */
const NO_PREFIX_KEYS = ['api', 'web']

/**
 * Load all routes from the registry
 */
export async function loadRoutes(registry: RouteRegistry): Promise<void> {
  // Load user-defined routes FIRST — they take priority over framework defaults.
  // bun-router silently ignores duplicate registrations (same method + path),
  // so whichever registers first wins. This ensures users can override any
  // framework route simply by defining the same path in routes/api.ts.
  for (const [key, definition] of Object.entries(registry)) {
    const config = normalizeDefinition(definition)
    const prefix = config.prefix !== undefined
      ? (config.prefix ? (config.prefix.startsWith('/') ? config.prefix : `/${config.prefix}`) : undefined)
      : (NO_PREFIX_KEYS.includes(key) ? undefined : `/${key}`)
    const middleware = normalizeMiddleware(config.middleware)
    log.debug(`[route-loader] Loading: ${config.path} prefix=${prefix || '/'} middleware=[${middleware.join(', ')}]`)

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
      const message = error instanceof Error ? error.message : String(error)
      console.error(`[Routes] Failed to load route file '${config.path}': ${message}`)
      throw new Error(`Route loading failed for '${config.path}': ${message}`)
    }
  }

  // Load framework default routes AFTER user routes.
  // Any route already registered by the user will cause the framework
  // version to be silently skipped, giving users full override control.
  await loadFrameworkRoutes()
}

/**
 * Load framework default routes from storage/framework/defaults/routes/
 */
async function loadFrameworkRoutes(): Promise<void> {
  try {
    await import('../../../defaults/routes/dashboard')
  }
  catch (error) {
    // Framework routes are optional — don't crash if they don't exist
    const message = error instanceof Error ? error.message : String(error)
    if (!message.includes('Cannot find module') && !message.includes('MODULE_NOT_FOUND')) {
      console.error(`[Routes] Failed to load framework routes: ${message}`)
    }
  }
}

/**
 * Import a route file from the routes directory
 */
async function importRouteFile(path: string): Promise<void> {
  // Remove .ts extension if present
  const cleanPath = path.replace(/\.ts$/, '')

  // Prevent path traversal
  if (cleanPath.includes('..') || cleanPath.startsWith('/')) {
    throw new Error(`Invalid route path: ${cleanPath}`)
  }

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
