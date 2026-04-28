import { existsSync } from 'node:fs'
import { parseOptions } from '@stacksjs/cli'
import { config } from '@stacksjs/config'
import { path } from '@stacksjs/path'
import { cors, route } from '@stacksjs/router'
import { generateAutoImportFiles, injectGlobalAutoImports } from '@stacksjs/server'

const _options = parseOptions()
const port = config.ports?.api || 3008

// Regenerate the model + function auto-import manifest ONLY when missing —
// regenerating on every boot (and thus every hot-reload cycle) triggers an
// infinite loop when a watcher is observing the auto-imports directory.
// initiateImports() handles live updates under the bundler plugin.
const modelsIndex = path.storagePath('framework/auto-imports/models.ts')
if (!existsSync(modelsIndex))
  await generateAutoImportFiles()

// Inject models + framework primitives (Action, response, schema, Auth) onto
// globalThis so user actions can use them without explicit imports, matching
// the "no imports needed" ergonomics of framework default actions.
await injectGlobalAutoImports()

// Enable CORS middleware
route.use(cors().handle.bind(cors()))

// Stamp X-Request-ID + start time on the request, then enrich the
// outbound response with the id, Server-Timing, and (for generic 404s) the
// requested path. Mounted at the global level (via route.use) so it
// covers auto-CRUD routes that register OUTSIDE the user route groups in
// routes/api.ts AND the bun-router-internal "no matching route" 404 path
// that bypasses our stacks-router wrappers entirely.
//
// bun-router middleware uses the (request, next) → next() shape — we MUST
// call next() and return its response so the pipeline continues.
const SAFE_REQUEST_ID = /^[a-zA-Z0-9._-]{8,128}$/
route.use(async (request: any, next: any) => {
  const inbound = request?.headers?.get?.('x-request-id') || request?.headers?.get?.('X-Request-ID') || ''
  const id = (typeof inbound === 'string' && SAFE_REQUEST_ID.test(inbound))
    ? inbound
    : crypto.randomUUID()
  request._requestId = id
  request._startNs = process.hrtime.bigint()

  const response: Response = await next()

  // Generic 404s come back as `{success:false, message:'Not Found'}` from
  // bun-router with no path context. Enrich them so debugging client
  // typos / stale SPA caches doesn't require server logs.
  if (
    response
    && response.status === 404
    && (response.headers.get('content-type') || '').includes('json')
  ) {
    try {
      const body = await response.clone().json() as any
      if (body && (body.message === 'Not Found' || body.error === 'Not Found')) {
        const url = new URL(request.url)
        const enriched = {
          ...body,
          path: url.pathname,
          method: request.method,
          request_id: id,
        }
        const headers = new Headers(response.headers)
        headers.set('X-Request-ID', id)
        return new Response(JSON.stringify(enriched), { status: 404, headers })
      }
    }
    catch { /* malformed JSON — fall through */ }
  }

  return response
})

// Import routes
await route.importRoutes()

// Start server (URL shown by unified dev output). Surface EADDRINUSE with a
// clear message — without this, the process exits with a stack trace that
// mentions `bun.serve` and `os` errno, which sends users hunting for the
// wrong cause when the actual fix is "another buddy dev is still running".
try {
  await route.serve({
    port,
    hostname: '127.0.0.1',
  })
}
catch (err: any) {
  const code = err?.code || err?.errno
  if (code === 'EADDRINUSE' || String(err?.message || '').includes('EADDRINUSE')) {
    console.error(`\n[dev/api] Port ${port} is already in use. Kill the other process and re-run \`./buddy dev\`, or set PORT_API to another port.\n`)
    process.exit(1)
  }
  throw err
}
