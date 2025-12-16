import process from 'node:process'
import { log, parseOptions } from '@stacksjs/cli'
import { config } from '@stacksjs/config'
import { route } from '@stacksjs/router'

const options = parseOptions()

log.debug('Starting API dev server...', options)

// CORS headers helper
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
  'Access-Control-Max-Age': '86400',
}

// Add explicit CORS middleware that always adds headers
route.use(async (req, next) => {
  const url = new URL(req.url)

  // Handle preflight OPTIONS requests
  if (req.method === 'OPTIONS') {
    console.log(`[API] --> OPTIONS ${url.pathname} (preflight)`)
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    })
  }

  const start = Date.now()
  console.log(`[API] --> ${req.method} ${url.pathname}`)

  try {
    const response = await next(req)
    const duration = Date.now() - start

    if (!response) {
      console.log(`[API] <-- ${req.method} ${url.pathname} 404 (no response) (${duration}ms)`)
      return new Response(JSON.stringify({ error: 'Not Found', path: url.pathname }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    console.log(`[API] <-- ${req.method} ${url.pathname} ${response.status} (${duration}ms)`)

    // Add CORS headers to the response
    const newHeaders = new Headers(response.headers)
    Object.entries(corsHeaders).forEach(([key, value]) => {
      newHeaders.set(key, value)
    })

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: newHeaders,
    })
  }
  catch (error) {
    const duration = Date.now() - start
    console.error(`[API] !!! ${req.method} ${url.pathname} ERROR (${duration}ms):`)
    console.error(error)

    // Return a proper error response with CORS headers
    return new Response(JSON.stringify({
      error: 'Internal Server Error',
      message: error instanceof Error ? error.message : String(error),
      stack: process.env.APP_ENV !== 'production' && error instanceof Error ? error.stack : undefined,
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})

// Import routes
await route.importRoutes()

// Start server
await route.serve({
  port: config.ports?.api || 3008,
  hostname: '127.0.0.1',
})
