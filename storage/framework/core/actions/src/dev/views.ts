import { AsyncLocalStorage } from 'node:async_hooks'
import { config } from '@stacksjs/config'
import { projectPath } from '@stacksjs/path'

/**
 * Boot the views/SSR dev server.
 *
 * If the project ships its own `serve.ts` we hand off to it (escape
 * hatch for custom needs). Otherwise we start the default stx serve
 * with sensible Stacks-aware options — including a server-side auth
 * gate that honours `definePageMeta({ middleware: ['auth'] })` on each
 * page so projects don't need a custom serve wrapper just to keep
 * /trips, /favorites, /host/* etc. behind a session.
 *
 * Two extras the default server bakes in for new scaffolds:
 *
 *   1. /api/** is reverse-proxied to the API dev server (port 3008 by
 *      default). Without this, `<form action="/api/foo">` posts on the
 *      frontend port land on stx-serve, which doesn't know about
 *      bun-router actions, and shoppers see a 404 page instead of
 *      their cart.
 *
 *   2. The raw Request's cookies are exposed to stx server-script
 *      blocks via a per-request AsyncLocalStorage on a stable global
 *      (`globalThis.requestContext`). stx-serve does not pass the
 *      Request into the template context, so anonymous-cart and
 *      session-aware pages would otherwise have no way to read their
 *      own cookie during SSR.
 */

const projectServe = projectPath('serve.ts')

try {
  const file = Bun.file(projectServe)
  if (await file.exists()) {
    await import(projectServe)
  }
  else {
    await startDefaultServer()
  }
}
catch {
  await startDefaultServer()
}

interface StacksRequestContext {
  cookies: Record<string, string>
  url: string
}

const requestStore = new AsyncLocalStorage<StacksRequestContext>()

// Stable global so server-script blocks (which run inside stx serve's
// fetch handler but without the raw Request) can read cookies.
;(globalThis as any).requestContext = {
  cookie(name: string): string | null {
    const ctx = requestStore.getStore()
    return ctx?.cookies?.[name] ?? null
  },
  url(): string {
    return requestStore.getStore()?.url ?? ''
  },
}

function parseCookies(req: Request): Record<string, string> {
  const out: Record<string, string> = {}
  const header = req.headers.get('cookie') || ''
  if (!header)
    return out
  for (const part of header.split(';')) {
    const trimmed = part.trim()
    const eq = trimmed.indexOf('=')
    if (eq === -1)
      continue
    const k = trimmed.slice(0, eq).trim()
    const v = trimmed.slice(eq + 1).trim()
    if (!k)
      continue
    try { out[k] = decodeURIComponent(v) }
    catch { out[k] = v }
  }
  return out
}

async function proxyToApi(req: Request, apiBase: string): Promise<Response> {
  const incoming = new URL(req.url)
  const target = `${apiBase}${incoming.pathname}${incoming.search}`

  const fwd = new Headers(req.headers)
  fwd.delete('host')
  fwd.delete('content-length')
  fwd.set('x-forwarded-host', incoming.host)
  fwd.set('x-forwarded-proto', incoming.protocol.replace(':', ''))

  const body = req.method === 'GET' || req.method === 'HEAD'
    ? undefined
    : await req.arrayBuffer()

  const upstream = await fetch(target, {
    method: req.method,
    headers: fwd,
    body,
    redirect: 'manual',
  })

  // Re-emit the body without the upstream's content-length /
  // content-encoding — the body we forward may be re-chunked, and
  // letting the original headers through breaks the response.
  const out = new Headers(upstream.headers)
  out.delete('content-length')
  out.delete('content-encoding')

  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: out,
  })
}

async function startDefaultServer() {
  let serve: any
  // Prefer the project-vendored pantry copy so framework patches and
  // bug fixes shipped via `cp` (or `pantry/install`) take effect even
  // when the global Bun install cache has an older `bun-plugin-stx`.
  try {
    ;({ serve } = await import(projectPath('pantry/bun-plugin-stx/dist/serve.js')))
  }
  catch {
    ;({ serve } = await import('bun-plugin-stx/serve'))
  }

  // Pre-resolve the stx module from pantry (if vendored). Bun resolves a
  // bare-specifier `import('@stacksjs/stx')` from the file doing the
  // import — for the pantry-vendored serve.js that's pantry/bun-plugin-stx,
  // and Bun walks up node_modules from there, finding the cwd's
  // `node_modules/@stacksjs/stx` first. If that copy is older than the
  // pantry-vendored stx (common when bun-plugin-stx in node_modules pinned
  // an older peer), the @extends/layoutsDir resolver behaves incorrectly
  // and pages render blank. Pass the pantry copy explicitly so serve()
  // uses it instead of letting bare-specifier resolution win.
  const stxModule = await resolveVendoredStxModule()

  const userViewsPath = 'resources/views'
  const defaultViewsPath = 'storage/framework/defaults/resources/views'
  // Layouts and partials live alongside views by default
  // (resources/views/layouts, resources/views/components). The legacy
  // resources/layouts and resources/components paths still exist on
  // older scaffolds, so we let stx-serve fall back to those via the
  // `fallbackLayoutsDir` / `fallbackPartialsDir` options.
  const userLayoutsPath = await firstExistingPath([
    'resources/views/layouts',
    'resources/layouts',
  ]) ?? 'resources/views/layouts'
  const defaultLayoutsPath = 'storage/framework/defaults/resources/layouts'
  const userComponentsPath = await firstExistingPath([
    'resources/views/components',
    'resources/components',
  ]) ?? 'resources/views/components'
  const preferredPort = Number(process.env.PORT) || 3000
  const apiPort = Number(process.env.PORT_API) || 3008
  const apiBase = `http://127.0.0.1:${apiPort}`

  // Cookie name the SPA writes when a user logs in. Defaults to whatever
  // `config.auth.defaultTokenName` is set to, falling back to `auth-token`.
  const authCookie = (config as any)?.auth?.defaultTokenName ?? 'auth-token'

  await serve({
    patterns: [userViewsPath, defaultViewsPath],
    port: preferredPort,
    // Wider than the dashboard subdir so both Dashboard/* and
    // Storefront/* (and any future <Namespace>/Component.stx) get
    // resolved. stx-serve walks one subdirectory deep, so this
    // gives us discovery without enumerating every namespace.
    componentsDir: 'storage/framework/defaults/resources/components',
    layoutsDir: userLayoutsPath,
    partialsDir: userComponentsPath,
    fallbackLayoutsDir: defaultLayoutsPath,
    fallbackPartialsDir: defaultViewsPath,
    quiet: true,
    ...(stxModule && { stxModule }),
    auth: {
      cookieName: authCookie,
      redirectTo: '/login',
    },
    onRequest: async (req: Request) => {
      const url = new URL(req.url)

      // /api/** → API dev server. Storefront forms posting to local
      // routes need this; without it the frontend's stx-serve answers
      // with a 404 page since it doesn't know about bun-router actions.
      if (url.pathname.startsWith('/api/'))
        return proxyToApi(req, apiBase)

      // Stash cookies + url so server-script blocks rendering this
      // request can pull them via globalThis.requestContext. We use
      // enterWith() rather than run() because returning here would
      // exit the async context before stx-serve resumes.
      requestStore.enterWith({
        cookies: parseCookies(req),
        url: req.url,
      })
      return null
    },
  } as any)
}

async function firstExistingPath(candidates: string[]): Promise<string | null> {
  for (const candidate of candidates) {
    try {
      const stat = await Bun.file(projectPath(candidate)).exists()
      if (stat)
        return candidate
    }
    catch { /* ignore */ }
  }
  return null
}

async function resolveVendoredStxModule(): Promise<any | undefined> {
  try {
    const vendored = projectPath('pantry/@stacksjs/stx/dist/index.js')
    if (await Bun.file(vendored).exists())
      return await import(vendored)
  }
  catch { /* fall through — let serve() use its own bare-specifier import */ }
  return undefined
}
