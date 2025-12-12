import type { Server } from 'bun'
import type { StacksRouter } from './router'
import process from 'node:process'
import { log } from '@stacksjs/logging'
import { path } from '@stacksjs/path'
import { fs } from '@stacksjs/storage'
import { getRouter, route as defaultRoute } from './router'

/**
 * MIME type mapping for static file serving
 */
const mimeTypes: Record<string, string> = {
  // Web assets
  '.html': 'text/html; charset=utf-8',
  '.htm': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',

  // Images
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.avif': 'image/avif',

  // Fonts
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.eot': 'application/vnd.ms-fontobject',

  // Documents
  '.pdf': 'application/pdf',
  '.txt': 'text/plain; charset=utf-8',

  // Media
  '.mp3': 'audio/mpeg',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.ogg': 'audio/ogg',
  '.wav': 'audio/wav',

  // Other
  '.wasm': 'application/wasm',
  '.map': 'application/json',
}

/**
 * Get MIME type for a file path
 */
function getMimeType(pathname: string): string {
  const ext = pathname.substring(pathname.lastIndexOf('.')).toLowerCase()
  return mimeTypes[ext] || 'application/octet-stream'
}

/**
 * Server configuration options
 */
export interface ServeOptions {
  /** Port to listen on (default: process.env.PORT or 3000) */
  port?: number
  /** Hostname to bind to (default: process.env.HOST or '0.0.0.0') */
  host?: string
  /** Router instance to use */
  router?: StacksRouter
  /** Enable static file serving (default: true) */
  staticFiles?: boolean
  /** Static file cache max-age in seconds (default: 31536000) */
  staticCacheMaxAge?: number
  /** Enable CORS for static files (default: true) */
  staticCors?: boolean
}

/**
 * Serve the Stacks application
 *
 * This function integrates bun-router with Stacks-specific features:
 * - Static file serving from public and resources directories
 * - Automatic route importing
 * - Graceful error handling
 *
 * @example
 * ```ts
 * import { serve } from '@stacksjs/router'
 *
 * // Basic usage
 * await serve()
 *
 * // Custom configuration
 * await serve({
 *   port: 8080,
 *   host: 'localhost',
 * })
 * ```
 */
export async function serve(options: ServeOptions = {}): Promise<Server> {
  const port = options.port || Number(process.env.PORT) || 3000
  const hostname = options.host || process.env.HOST || '127.0.0.1'
  const staticFiles = options.staticFiles ?? true
  const staticCacheMaxAge = options.staticCacheMaxAge ?? 31536000
  const staticCors = options.staticCors ?? true

  // Get router instance
  const route = options.router || getRouter() || defaultRoute

  // Import routes if not already registered
  if (route && typeof route.getRoutes === 'function') {
    const existingRoutes = await route.getRoutes()
    if (existingRoutes.length === 0) {
      await route.importRoutes()
    }
  }

  // Wait for all pending route registrations
  if (route && typeof route.waitForRoutes === 'function') {
    await route.waitForRoutes()
  }

  // Log registered routes
  const routes = await route.getRoutes()
  log.info('Registered Routes:')
  for (const r of routes) {
    log.info(`  ${r.method.padEnd(7)} ${r.uri}`)
  }
  log.info(`Total: ${routes.length} routes`)

  // Create server with static file handling and bun-router integration
  const server = Bun.serve({
    port,
    hostname,

    async fetch(req: Request): Promise<Response> {
      const url = new URL(req.url)

      // Serve static files first (if enabled)
      if (staticFiles && req.method === 'GET') {
        const staticResponse = await serveStaticFile(url.pathname, {
          cacheMaxAge: staticCacheMaxAge,
          cors: staticCors,
        })
        if (staticResponse) {
          return staticResponse
        }
      }

      // Delegate to bun-router for route handling
      try {
        return await route.bunRouter.handleRequest(req)
      }
      catch (error: any) {
        log.error('Request handling error:', error)
        return Response.json(
          { error: error.message || 'Internal server error' },
          { status: error.status || 500 },
        )
      }
    },
  })

  log.info(`Server running at http://${hostname}:${port}`)

  return server
}

/**
 * Static file serving options
 */
interface StaticFileOptions {
  cacheMaxAge?: number
  cors?: boolean
}

/**
 * Check if a path is a regular file (not a directory, socket, symlink, etc.)
 */
function isRegularFile(filePath: string): boolean {
  try {
    const stat = fs.statSync(filePath)
    return stat.isFile()
  }
  catch {
    return false
  }
}

/**
 * Serve a static file if it exists
 */
async function serveStaticFile(
  pathname: string,
  options: StaticFileOptions = {},
): Promise<Response | null> {
  const { cacheMaxAge = 31536000, cors = true } = options

  // Build headers for static files
  const headers: Record<string, string> = {
    'Content-Type': getMimeType(pathname),
    'Cache-Control': `public, max-age=${cacheMaxAge}, immutable`,
  }

  if (cors) {
    headers['Access-Control-Allow-Origin'] = '*'
  }

  // Try public directory first (compiled assets)
  if (pathname.startsWith('/assets/')) {
    const publicPath = path.publicPath(pathname.slice(1)) // Remove leading /
    if (isRegularFile(publicPath)) {
      const file = Bun.file(publicPath)
      return new Response(file, { headers })
    }

    // Try resources/assets (source assets - CSS, JS, etc.)
    const assetsPath = path.resourcesPath(pathname.slice(1))
    if (isRegularFile(assetsPath)) {
      const file = Bun.file(assetsPath)
      return new Response(file, { headers })
    }
  }

  // Try public directory for other static files
  const publicFilePath = path.publicPath(pathname.slice(1))
  if (isRegularFile(publicFilePath)) {
    const file = Bun.file(publicFilePath)
    return new Response(file, { headers })
  }

  return null
}

/**
 * Handle a request and return a response
 *
 * This is a standalone function for custom server implementations
 * that want to use Stacks routing without the full serve() function.
 *
 * @example
 * ```ts
 * import { serverResponse } from '@stacksjs/router'
 *
 * Bun.serve({
 *   fetch(req) {
 *     return serverResponse(req)
 *   }
 * })
 * ```
 */
export async function serverResponse(request: Request): Promise<Response> {
  const route = getRouter() || defaultRoute
  const url = new URL(request.url)

  // Try to serve static files first
  if (request.method === 'GET') {
    const staticResponse = await serveStaticFile(url.pathname)
    if (staticResponse) {
      return staticResponse
    }
  }

  // Delegate to bun-router
  try {
    return await route.bunRouter.handleRequest(request)
  }
  catch (error: any) {
    log.error('Request handling error:', error)
    return Response.json(
      { error: error.message || 'Internal server error' },
      { status: error.status || 500 },
    )
  }
}

/**
 * Create a request handler function for use with Bun.serve
 *
 * @example
 * ```ts
 * import { createRequestHandler } from '@stacksjs/router'
 *
 * const handler = createRequestHandler()
 * Bun.serve({ fetch: handler })
 * ```
 */
export function createRequestHandler(
  router?: StacksRouter,
  options: StaticFileOptions = {},
): (request: Request) => Promise<Response> {
  const route = router || getRouter() || defaultRoute

  return async (request: Request): Promise<Response> => {
    const url = new URL(request.url)

    // Try static files first
    if (request.method === 'GET') {
      const staticResponse = await serveStaticFile(url.pathname, options)
      if (staticResponse) {
        return staticResponse
      }
    }

    // Delegate to router
    try {
      return await route.bunRouter.handleRequest(request)
    }
    catch (error: any) {
      log.error('Request handling error:', error)
      return Response.json(
        { error: error.message || 'Internal server error' },
        { status: error.status || 500 },
      )
    }
  }
}

// Re-export route instance for use in route files
export { defaultRoute as route }

// Export MIME types for external use
export { mimeTypes, getMimeType }
