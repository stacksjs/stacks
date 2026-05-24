import { AsyncLocalStorage } from 'node:async_hooks'
import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { config, overridesReady } from '@stacksjs/config'
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
 *   1. /api/** and /docs/** are reverse-proxied to the API and docs dev
 *      servers. Without this, form posts and doc assets on the frontend
 *      port land on stx-serve and 404.
 *
 *   2. The raw Request's cookies are exposed to stx server-script
 *      blocks via a per-request AsyncLocalStorage on a stable global
 *      (`globalThis.requestContext`). stx-serve does not pass the
 *      Request into the template context, so anonymous-cart and
 *      session-aware pages would otherwise have no way to read their
 *      own cookie during SSR.
 */

interface StacksRequestContext {
  cookies: Record<string, string>
  url: string
  locale: string
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
  locale(): string {
    return requestStore.getStore()?.locale ?? 'de'
  },
}

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

async function proxyToBackend(req: Request, backendBase: string, stripPrefix?: string): Promise<Response> {
  const incoming = new URL(req.url)
  let pathname = incoming.pathname
  if (stripPrefix && (pathname === stripPrefix || pathname.startsWith(`${stripPrefix}/`))) {
    pathname = pathname.slice(stripPrefix.length) || '/'
  }
  const target = `${backendBase}${pathname}${incoming.search}`

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
  await overridesReady

  const { injectGlobalAutoImports } = await import('@stacksjs/server')
  const { applyRequestLocale } = await import('@stacksjs/i18n')
  await injectGlobalAutoImports()

  let serve: any
  let loadedServeFrom: string | undefined
  // Prefer ~/Code/Tools/stx (local STX worktree), then project pantry.
  const serveCandidates = [
    join(homedir(), 'Code/Tools/stx/packages/bun-plugin/dist/serve.js'),
    projectPath('pantry/bun-plugin-stx/dist/serve.js'),
  ]
  for (const entry of serveCandidates) {
    try {
      if (existsSync(entry)) {
        ;({ serve } = await import(entry))
        loadedServeFrom = entry
        break
      }
    }
    catch { /* try next */ }
  }
  if (!serve) {
    ;({ serve } = await import('bun-plugin-stx/serve'))
    loadedServeFrom = 'bun-plugin-stx/serve'
  }
  if (loadedServeFrom)
    console.log(`[stx] dev serve: ${loadedServeFrom}`)

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
  const { site: siteConfig, i18n: i18nConfig } = await loadStxSiteConfig(stxModule)

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
  const docsPort = Number(process.env.PORT_DOCS) || config.ports?.docs || 3006
  const apiBase = `http://127.0.0.1:${apiPort}`
  const docsBase = `http://127.0.0.1:${docsPort}`

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
    ...(i18nConfig && { i18n: i18nConfig }),
    ...(siteConfig?.url && { site: siteConfig }),
    auth: {
      cookieName: authCookie,
      redirectTo: '/login',
    },
    onRequest: async (req: Request) => {
      const url = new URL(req.url)

      // Maintenance / coming-soon gate. Runs first so it can intercept
      // both stx page renders and API-bound traffic. The gate itself
      // allowlists `/coming-soon`, `/api/email/subscribe`, the secret
      // bypass URL, and static assets — so the holding page renders
      // and visitors with a magic-link cookie pass through normally.
      const { maintenanceGate } = await import('@stacksjs/server')
      const gated = await maintenanceGate(req)
      if (gated)
        return gated

      // Forward to the API dev server when this request can't possibly
      // be a stx page render. Two cases:
      //   1. `/api/**` — the canonical API prefix.
      //   2. Any non-GET/HEAD verb — POST/PUT/PATCH/DELETE never match
      //      a static stx page, so they always belong to bun-router.
      // Without (2), `route.post('/subscribe', ...)` declared at the
      // root (no /api prefix) hits stx-serve and 404s.
      const apiMethods = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])
      if (url.pathname === '/docs' || url.pathname.startsWith('/docs/'))
        return proxyToBackend(req, docsBase, '/docs')

      if (url.pathname.startsWith('/api/') || apiMethods.has(req.method))
        return proxyToBackend(req, apiBase)

      // Optional `/locale/{code}` redirect (same as default SetLocaleAction).
      // STX i18n normally switches via `/<code>/…` paths from the injected
      // lang-picker script; this handles bookmarked `/locale/…` URLs on the
      // frontend dev server without an app-level `routes/web.ts` entry.
      if (i18nConfig && req.method === 'GET') {
        const localeSwitch = url.pathname.match(/^\/locale\/([a-z]{2}(?:-[a-z]{2})?)\/?$/i)
        if (localeSwitch) {
          const { createLocaleSwitchResponse } = await import('@stacksjs/i18n')
          return createLocaleSwitchResponse(req, localeSwitch[1], i18nConfig)
        }
      }

      // Stash cookies + url so server-script blocks rendering this
      // request can pull them via globalThis.requestContext. We use
      // enterWith() rather than run() because returning here would
      // exit the async context before stx-serve resumes.
      const locale = await applyRequestLocale(req)

      ;(globalThis as { __stxServeSearch?: string }).__stxServeSearch = url.search

      requestStore.enterWith({
        cookies: parseCookies(req),
        url: req.url,
        locale,
      })
      return null
    },
  } as any)
}

async function firstExistingPath(candidates: string[]): Promise<string | null> {
  // existsSync, not `Bun.file(dir).exists()` — `Bun.file` is file-only
  // and returns false for any directory, which would cause every
  // candidate to fall through to the caller's default and silently
  // break projects whose layouts/components live at the legacy paths
  // (`resources/{layouts,components}/`) instead of the canonical
  // `resources/views/{layouts,components}/`.
  for (const candidate of candidates) {
    if (existsSync(projectPath(candidate)))
      return candidate
  }
  return null
}

async function resolveVendoredStxModule(): Promise<any | undefined> {
  const candidates = [
    join(homedir(), 'Code/Tools/stx/packages/stx/dist/index.js'),
    projectPath('pantry/@stacksjs/stx/dist/index.js'),
  ]
  for (const entry of candidates) {
    try {
      if (existsSync(entry))
        return await import(entry)
    }
    catch { /* try next */ }
  }
  return undefined
}

function fallbackI18nFromSite(site: { i18n: { locales: string[], defaultLocale?: string, pickerSelector?: string, labels?: Record<string, string> } }) {
  const locales = site.i18n.locales
  const defaultLocale = site.i18n.defaultLocale ?? locales[0]
  return {
    locales,
    defaultLocale,
    labels: site.i18n.labels ?? Object.fromEntries(locales.map(c => [c, c.toUpperCase()])),
    translations: {} as Record<string, Record<string, string>>,
    pickerSelector: site.i18n.pickerSelector ?? '#lang-picker',
  }
}

async function resolveSiteI18n(site: { i18n: { locales: string[], defaultLocale?: string, translationsDir?: string | false, format?: string, labels?: Record<string, string>, pickerSelector?: string, translations?: Record<string, Record<string, string>> } }) {
  const resolverPaths = [
    join(homedir(), 'Code/Tools/stx/packages/stx/src/site-builder/i18n.ts'),
    join(homedir(), 'Code/Tools/stx/packages/stx/dist/index.js'),
    projectPath('pantry/@stacksjs/stx/dist/index.js'),
  ]
  for (const resolverPath of resolverPaths) {
    try {
      if (!existsSync(resolverPath))
        continue
      const resolved = await import(resolverPath)
      if (typeof resolved.resolveI18n !== 'function')
        continue
      const i18n = resolved.resolveI18n(site, projectPath())
      if (i18n)
        return i18n
    }
    catch { /* try next */ }
  }
  return fallbackI18nFromSite(site)
}

async function loadStxSiteConfig(_stxModule: any): Promise<{ site?: any, i18n?: any }> {
  const sitePath = projectPath('site.config.ts')
  if (!existsSync(sitePath))
    return {}

  try {
    const mod = await import(sitePath)
    const site = mod.default
    if (!site)
      return {}

    if (!site.i18n)
      return { site }

    const i18n = await resolveSiteI18n(site)
    return { site, i18n }
  }
  catch { /* no site config */ }

  return {}
}
