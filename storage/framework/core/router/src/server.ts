import type { Server } from 'bun'
import process from 'node:process'
import { log } from '@stacksjs/logging'
import { path } from '@stacksjs/path'
import { fs } from '@stacksjs/storage'
import { getRouter, route as defaultRoute, Router } from './router'

// Static file extension to MIME type mapping
const mimeTypes: Record<string, string> = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.eot': 'application/vnd.ms-fontobject',
}

function getMimeType(pathname: string): string {
  const ext = pathname.substring(pathname.lastIndexOf('.'))
  return mimeTypes[ext] || 'application/octet-stream'
}

/**
 * Serve options interface
 */
interface ServeOptions {
  port?: number
  host?: string
  router?: Router
}

/**
 * Serve the application using bun-router
 *
 * This function uses the underlying bun-router for request handling
 * while supporting stacks-specific features like static file serving
 */
export async function serve(options: ServeOptions = {}): Promise<Server<any>> {
  const port = options.port || Number(process.env.PORT) || 3000
  const hostname = options.host || process.env.HOST || '0.0.0.0'

  // Use provided router, try globalThis, or fall back to default
  const route = options.router || getRouter() || defaultRoute

  // Only import routes if not already registered (for backwards compatibility)
  if (route && typeof route.getRoutes === 'function') {
    const existingRoutes = await route.getRoutes()
    if (existingRoutes.length === 0) {
      await route.importRoutes()
    }
  }

  // Wait for all pending route registrations to complete
  if (route && typeof route.waitForRoutes === 'function') {
    await route.waitForRoutes()
  }

  // Get routes list for logging
  const routes = await route.getRoutes()

  log.info('Routes List:')
  for (const r of routes) {
    log.info(`  ${r.method} ${r.uri}`)
  }

  // Debug: log bun-router routes count
  log.info(`BunRouter has ${route.bunRouter.routes.length} routes registered`)

  // Create the server using Bun.serve with bun-router's handleRequest
  const server = Bun.serve({
    port,
    hostname,

    async fetch(req: Request): Promise<Response> {
      const url = new URL(req.url)

      // Try to serve static files first
      if (req.method === 'GET') {
        // Try public directory first (compiled assets)
        if (url.pathname.startsWith('/assets/')) {
          const publicPath = path.publicPath(url.pathname.slice(1)) // Remove leading /
          if (fs.existsSync(publicPath)) {
            const file = Bun.file(publicPath)
            return new Response(file, {
              headers: {
                'Content-Type': getMimeType(url.pathname),
                'Cache-Control': 'public, max-age=31536000, immutable',
                'Access-Control-Allow-Origin': '*',
              },
            })
          }
        }

        // Try resources/assets (source assets - CSS, JS, etc.)
        if (url.pathname.startsWith('/assets/')) {
          const assetsPath = path.resourcesPath(url.pathname.slice(1))
          if (fs.existsSync(assetsPath)) {
            const file = Bun.file(assetsPath)
            return new Response(file, {
              headers: {
                'Content-Type': getMimeType(url.pathname),
                'Cache-Control': 'public, max-age=31536000, immutable',
                'Access-Control-Allow-Origin': '*',
              },
            })
          }
        }
      }

      // Delegate to bun-router for all other requests
      try {
        return await route.bunRouter.handleRequest(req)
      }
      catch (error: any) {
        log.error('Request handling error:', error)
        return Response.json({ error: error.message || 'Internal server error' }, { status: 500 })
      }
    },
  })

  log.info(`Server running at http://${hostname}:${port}`)

  return server
}

/**
 * Handle a request and return a response
 * This is a simple wrapper for the bun-router's handleRequest
 * that can be used in custom server implementations
 */
export async function serverResponse(request: Request, _body?: string): Promise<Response> {
  const route = getRouter() || defaultRoute
  const url = new URL(request.url)

  // Try to serve static files first
  if (request.method === 'GET') {
    // Try public directory first (compiled assets)
    if (url.pathname.startsWith('/assets/')) {
      const publicPath = path.publicPath(url.pathname.slice(1)) // Remove leading /
      if (fs.existsSync(publicPath)) {
        const file = Bun.file(publicPath)
        return new Response(file, {
          headers: {
            'Content-Type': getMimeType(url.pathname),
            'Cache-Control': 'public, max-age=31536000, immutable',
            'Access-Control-Allow-Origin': '*',
          },
        })
      }
    }

    // Try resources/assets (source assets - CSS, JS, etc.)
    if (url.pathname.startsWith('/assets/')) {
      const assetsPath = path.resourcesPath(url.pathname.slice(1))
      if (fs.existsSync(assetsPath)) {
        const file = Bun.file(assetsPath)
        return new Response(file, {
          headers: {
            'Content-Type': getMimeType(url.pathname),
            'Cache-Control': 'public, max-age=31536000, immutable',
            'Access-Control-Allow-Origin': '*',
          },
        })
      }
    }
  }

  // Delegate to bun-router for all other requests
  try {
    return await route.bunRouter.handleRequest(request)
  }
  catch (error: any) {
    log.error('Request handling error:', error)
    return Response.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}

// Export the route instance for use in route files
export { defaultRoute as route }
