/**
 * Maintenance Mode
 *
 * Laravel-like maintenance mode for putting the application
 * into a "down" state during deployments or updates.
 *
 * @example
 * // Put app in maintenance mode
 * await down({ secret: 'my-bypass-token' })
 *
 * // Bring app back up
 * await up()
 *
 * // Check if in maintenance
 * if (await isDownForMaintenance()) { ... }
 */

import { log } from '@stacksjs/logging/runtime'
import * as p from '@stacksjs/path'
import { existsSync } from 'node:fs'

export type SiteMode = 'maintenance' | 'coming-soon'

export interface MaintenancePayload {
  /** Which protected site mode is active */
  mode?: SiteMode
  /** When maintenance mode was activated */
  time: number
  /** Optional message to display */
  message?: string
  /** Optional headline to display */
  title?: string
  /** Retry-After header value in seconds */
  retry?: number
  /** Secret token for bypassing maintenance mode */
  secret?: string
  /** Allowed IP addresses */
  allowed?: string[]
  /** HTTP status code (default: 503) */
  status?: number
  /** Custom template path */
  template?: string
  /** Redirect URL instead of showing maintenance page */
  redirect?: string
}

/**
 * Default maintenance payload
 */
const DEFAULT_MAINTENANCE_PAYLOAD: Partial<MaintenancePayload> = {
  mode: 'maintenance',
  status: 503,
  message: 'We are currently performing maintenance. Please check back soon.',
}

const DEFAULT_COMING_SOON_PAYLOAD: Partial<MaintenancePayload> = {
  mode: 'coming-soon',
  status: 200,
  message: 'We are getting ready to launch. Check back soon.',
  // Redirect to the user's marketing holding page rather than the
  // framework's inline themed HTML. The view lives at
  // `storage/framework/defaults/resources/views/coming-soon.stx`
  // (mounts `<ComingSoon />`) and is the customisable surface — it
  // ships with an email-subscribe form wired to /api/email/subscribe.
  // Override with `comingSoon({ redirect: undefined })` to use the
  // inline themed page instead.
  redirect: '/coming-soon',
}

function defaultsForMode(mode: SiteMode): Partial<MaintenancePayload> {
  return mode === 'coming-soon' ? DEFAULT_COMING_SOON_PAYLOAD : DEFAULT_MAINTENANCE_PAYLOAD
}

// Cache filenames only. Gate checks still read the live files on every request.
let siteModePaths: { cwd: string, maintenance?: string, comingSoon?: string } | undefined

function currentSiteModePaths(): NonNullable<typeof siteModePaths> {
  const cwd = process.cwd()
  if (siteModePaths?.cwd !== cwd)
    siteModePaths = { cwd }
  return siteModePaths
}

/**
 * Get the path to the maintenance file
 */
export function maintenanceFilePath(): string {
  return currentSiteModePaths().maintenance ??= p.storagePath('framework/down')
}

export function comingSoonFilePath(): string {
  return currentSiteModePaths().comingSoon ??= p.storagePath('framework/coming-soon')
}

export function siteModeFilePath(mode: SiteMode): string {
  return mode === 'coming-soon' ? comingSoonFilePath() : maintenanceFilePath()
}

/**
 * Check if the application is in maintenance mode
 */
export async function isDownForMaintenance(): Promise<boolean> {
  try {
    return existsSync(maintenanceFilePath())
  }
  catch {
    return false
  }
}

export async function isComingSoon(): Promise<boolean> {
  try {
    return existsSync(comingSoonFilePath())
  }
  catch {
    return false
  }
}

/**
 * Get the maintenance mode payload
 */
export async function maintenancePayload(): Promise<MaintenancePayload | null> {
  return siteModePayload('maintenance')
}

export async function comingSoonPayload(): Promise<MaintenancePayload | null> {
  return siteModePayload('coming-soon')
}

function readSiteModePayload(mode: SiteMode): Promise<MaintenancePayload | null> | null {
  try {
    const filePath = siteModeFilePath(mode)

    if (!existsSync(filePath))
      return null

    return Bun.file(filePath).text().then(content => ({
      ...defaultsForMode(mode),
      ...JSON.parse(content),
      mode,
    } as MaintenancePayload)).catch(() => null)
  }
  catch {
    return null
  }
}

export async function siteModePayload(mode: SiteMode): Promise<MaintenancePayload | null> {
  return readSiteModePayload(mode)
}

function comingSoonPayloadResult(): Promise<MaintenancePayload | null> | MaintenancePayload | null {
  const payload = readSiteModePayload('coming-soon')
  return payload ? payload.then(value => value ?? envSiteModePayload()) : envSiteModePayload()
}

function activeSiteModePayloadResult(): Promise<MaintenancePayload | null> | MaintenancePayload | null {
  const payload = readSiteModePayload('maintenance')
  return payload ? payload.then(value => value ?? comingSoonPayloadResult()) : comingSoonPayloadResult()
}

export async function activeSiteModePayload(): Promise<MaintenancePayload | null> {
  return activeSiteModePayloadResult()
}

function envSiteModePayload(): MaintenancePayload | null {
  if (isTruthy(process.env.APP_MAINTENANCE)) {
    return {
      ...DEFAULT_MAINTENANCE_PAYLOAD,
      mode: 'maintenance',
      time: Date.now(),
      secret: process.env.APP_MAINTENANCE_SECRET || undefined,
    } as MaintenancePayload
  }

  if (isTruthy(process.env.APP_COMING_SOON)) {
    return {
      ...DEFAULT_COMING_SOON_PAYLOAD,
      mode: 'coming-soon',
      time: Date.now(),
      secret: process.env.APP_COMING_SOON_SECRET || undefined,
    } as MaintenancePayload
  }

  return null
}

function isTruthy(value: string | undefined): boolean {
  const normalized = value?.toLowerCase()
  return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on'
}

/**
 * Put the application into maintenance mode
 */
export async function down(options: Partial<MaintenancePayload> = {}): Promise<void> {
  const payload: MaintenancePayload = {
    ...DEFAULT_MAINTENANCE_PAYLOAD,
    ...options,
    mode: 'maintenance',
    time: Date.now(),
  }

  // Ensure the storage/framework directory exists
  const frameworkDir = p.storagePath('framework')
  const { mkdirSync, existsSync } = await import('@stacksjs/storage')

  if (!existsSync(frameworkDir)) {
    mkdirSync(frameworkDir, { recursive: true })
  }

  // Write the maintenance file
  await Bun.write(maintenanceFilePath(), JSON.stringify(payload, null, 2))

  log.info('Application is now in maintenance mode.')

  if (payload.secret) {
    log.info('Maintenance bypass secret has been configured')
  }
}

export async function comingSoon(options: Partial<MaintenancePayload> = {}): Promise<void> {
  const payload: MaintenancePayload = {
    ...DEFAULT_COMING_SOON_PAYLOAD,
    ...options,
    mode: 'coming-soon',
    time: Date.now(),
  }

  const frameworkDir = p.storagePath('framework')
  const { mkdirSync, existsSync } = await import('@stacksjs/storage')

  if (!existsSync(frameworkDir)) {
    mkdirSync(frameworkDir, { recursive: true })
  }

  await Bun.write(comingSoonFilePath(), JSON.stringify(payload, null, 2))

  log.info('Application is now in coming soon mode.')

  if (payload.secret) {
    log.info('Coming soon bypass secret has been configured')
  }
}

/**
 * Bring the application out of maintenance mode
 */
export async function up(): Promise<void> {
  const { unlinkSync, existsSync } = await import('node:fs')
  const filePath = maintenanceFilePath()

  if (existsSync(filePath)) {
    unlinkSync(filePath)
    log.info('Application is now live.')
  }
  else {
    log.info('Application is already live.')
  }
}

export async function launch(): Promise<void> {
  const { unlinkSync, existsSync } = await import('node:fs')
  const filePath = comingSoonFilePath()

  if (existsSync(filePath)) {
    unlinkSync(filePath)
    log.info('Application is out of coming soon mode.')
  }
  else {
    log.info('Application is not in coming soon mode.')
  }
}

/**
 * Check if an IP address is allowed during maintenance
 */
export function isAllowedIp(ip: string, allowed: string[] = [], trustLocalhost = true): boolean {
  // Localhost is convenient in development, but deployed reverse proxies
  // commonly reach the app over loopback. Production/staging callers must
  // opt out or every proxied visitor can inherit this bypass when the proxy
  // does not forward a client-IP header.
  const localhostIps = ['127.0.0.1', '::1', 'localhost']
  if (trustLocalhost && localhostIps.includes(ip)) {
    return true
  }

  if (allowed.length === 0) {
    return false
  }

  return allowed.includes(ip)
}

/**
 * Check if a request has a valid bypass cookie
 */
export function bypassCookieName(mode: SiteMode = 'maintenance'): string {
  return mode === 'coming-soon' ? 'stacks_coming_soon_bypass' : 'stacks_maintenance_bypass'
}

export function hasValidBypassCookie(cookies: Record<string, string>, secret: string, mode: SiteMode = 'maintenance'): boolean {
  const bypassCookie = cookies[bypassCookieName(mode)]
  return bypassCookie === secret
}

/**
 * Check if a request path matches the bypass secret
 */
export function isSecretPath(path: string, secret: string): boolean {
  return path === `/${secret}` || path.startsWith(`/${secret}/`)
}

/**
 * Generate maintenance mode HTML response
 *
 * Every app gets this page, so it carries no brand of its own: the app's name
 * (APP_NAME) above the headline, system fonts, and nothing fetched. It used to
 * be the stacksjs.com park theme ("Trail Maintenance", "Stacks basecamp"),
 * with fonts and illustrations loaded from `/assets/fonts/nps` and
 * `/assets/images` in the app's public directory, which only stacksjs.com has.
 * Every other app showed another project's copy in fallback fonts.
 */
export function maintenanceHtml(payload: MaintenancePayload): string {
  const mode = payload.mode ?? 'maintenance'
  const defaults = defaultsForMode(mode)
  const message = escapeHtml(payload.message || defaults.message || '')
  const title = escapeHtml(payload.title || (mode === 'coming-soon' ? 'Coming soon' : 'Down for maintenance'))
  const appName = escapeHtml((process.env.APP_NAME || '').trim())

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="robots" content="noindex">
  <title>${appName ? `${title} - ${appName}` : title}</title>
  <style>
    :root {
      color-scheme: light dark;
      --bg: #fafafa;
      --fg: #171717;
      --muted: #525252;
      --rule: #e5e5e5;
    }
    @media (prefers-color-scheme: dark) {
      :root {
        --bg: #0a0a0a;
        --fg: #fafafa;
        --muted: #a3a3a3;
        --rule: #262626;
      }
    }
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
      background: var(--bg);
      color: var(--fg);
      font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
      -webkit-font-smoothing: antialiased;
    }
    main {
      width: min(560px, 100%);
    }
    .app {
      color: var(--muted);
      font-size: .875rem;
      font-weight: 500;
    }
    h1 {
      margin-top: .5rem;
      font-size: clamp(2rem, 6vw, 2.75rem);
      font-weight: 600;
      letter-spacing: -.02em;
      line-height: 1.1;
    }
    .message,
    .retry {
      margin-top: 1rem;
      color: var(--muted);
      font-size: 1.0625rem;
      line-height: 1.6;
    }
    .retry {
      padding-top: 1rem;
      border-top: 1px solid var(--rule);
      font-size: .9375rem;
    }
  </style>
</head>
<body>
  <main>
    ${appName ? `<p class="app">${appName}</p>` : ''}
    <h1>${title}</h1>
    ${message ? `<p class="message">${message}</p>` : ''}
    ${payload.retry ? `<p class="retry">Expected back in about ${Math.ceil(payload.retry / 60)} minutes.</p>` : ''}
  </main>
</body>
</html>`
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

/**
 * Create a maintenance mode response
 */
export function maintenanceResponse(payload: MaintenancePayload): Response {
  return siteModeResponse(payload)
}

export function siteModeResponse(payload: MaintenancePayload): Response {
  const headers: Record<string, string> = {
    'Content-Type': 'text/html; charset=utf-8',
  }

  if (payload.retry) {
    headers['Retry-After'] = String(payload.retry)
  }

  // Handle redirect
  if (payload.redirect) {
    return new Response(null, {
      status: 302,
      headers: { Location: payload.redirect },
    })
  }

  return new Response(maintenanceHtml(payload), {
    status: payload.status || (payload.mode === 'coming-soon' ? 200 : 503),
    headers,
  })
}

/**
 * Create bypass cookie
 */
export function bypassCookieValue(secret: string, mode: SiteMode = 'maintenance'): string {
  return `${bypassCookieName(mode)}=${secret}; Path=/; HttpOnly; SameSite=Lax`
}

/**
 * Paths that are always allowed through maintenance/coming-soon mode.
 * - `/coming-soon` itself must render (else the redirect loops).
 * - `/api/email/subscribe` so the email-capture form on the holding
 *   page still works.
 * - Static assets used by the holding page (favicon, logo, etc.) so it
 *   renders correctly. The dev server serves these directly; in prod
 *   they're typically CDN'd — the allowlist is the safety net.
 *
 * Matched by prefix AND by extension, because a holding page that cannot load
 * its own stylesheet is the failure this list exists to prevent, and not every
 * project keeps its CSS under `/css/`.
 */
const ALWAYS_ALLOWED_PATHS = new Set([
  '/coming-soon',
  '/api/email/subscribe',
  '/favicon.ico',
])

const ALWAYS_ALLOWED_PREFIXES = [
  '/css/',
  '/js/',
  '/images/',
  '/fonts/',
  '/assets/',
  '/_stx/',
  '/_modules/',
  '/@vite/',
  '/@fs/',
  '/__deps/',
]

/**
 * Static assets, wherever they are served from.
 *
 * The prefix list above assumes a tidy `/css/…` layout, and a real application
 * does not always have one: a stylesheet linked as `/tokens.css` sits at the
 * document root and matched nothing, so the gate redirected it to the holding
 * page. The page then answered 200 with every `var()` falling back to its
 * initial value - unstyled, in a serif, on a live domain - and no status-code
 * check noticed, because the HTML was fine.
 *
 * An extension allowlist rather than "anything with a dot": `/about.html` and
 * `/report.pdf` are pages and documents, and coming-soon mode is meant to
 * withhold those.
 */
const ALWAYS_ALLOWED_EXTENSIONS = [
  '.css',
  '.js',
  '.mjs',
  '.map',
  '.woff',
  '.woff2',
  '.ttf',
  '.otf',
  '.eot',
  '.svg',
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.webp',
  '.avif',
  '.ico',
]

/**
 * Extra paths an application declares reachable while the curtain is up, as
 * `APP_MAINTENANCE_ALLOW` (comma-separated).
 *
 * The lists above cover the holding page and its assets, which is all the
 * framework can know about on its own. An application knows more: a public
 * share link someone handed to a colleague, a status endpoint a monitor polls,
 * a webhook a payment provider will retry into. Every one of those is meant to
 * answer a caller who already has the URL, and every one of them the gate would
 * otherwise redirect to a marketing page — silently, with a 302 that looks
 * healthy to anything not following it.
 *
 * Entries are exact paths, or prefixes written with a trailing `/` or `*`:
 *
 *   APP_MAINTENANCE_ALLOW=/share/*,/api/share/*,/healthz
 *
 * Read per call rather than captured at import, because `buddy down` and
 * `buddy coming-soon` flip modes inside a running process and an allowlist
 * frozen at import would behave differently there than after a restart.
 */
function configuredAllowList(): string[] {
  const raw = process.env.APP_MAINTENANCE_ALLOW ?? process.env.APP_COMING_SOON_ALLOW ?? ''

  return raw.split(',').map(entry => entry.trim()).filter(Boolean)
}

/** Whether `path` matches one of the application's declared exceptions. */
function isConfiguredAllowed(path: string): boolean {
  for (const entry of configuredAllowList()) {
    // `/share/*` and `/share/` both mean "everything under /share/". The
    // wildcard form is spelled the way people expect to write it; the trailing
    // slash is what they write when they forget the wildcard.
    if (entry.endsWith('*')) {
      if (path.startsWith(entry.slice(0, -1)))
        return true

      continue
    }

    if (entry.endsWith('/')) {
      if (path.startsWith(entry))
        return true

      continue
    }

    if (path === entry)
      return true
  }

  return false
}

export function isAlwaysAllowed(path: string): boolean {
  if (ALWAYS_ALLOWED_PATHS.has(path))
    return true

  if (isConfiguredAllowed(path))
    return true

  if (ALWAYS_ALLOWED_PREFIXES.some(p => path.startsWith(p)))
    return true

  const lower = path.toLowerCase()

  return ALWAYS_ALLOWED_EXTENSIONS.some(ext => lower.endsWith(ext))
}

/**
 * Parse a Cookie header into a flat map.
 */
function parseCookieHeader(header: string | null): Record<string, string> {
  const out: Record<string, string> = {}
  if (!header)
    return out
  for (const part of header.split(';')) {
    const trimmed = part.trim()
    const eq = trimmed.indexOf('=')
    if (eq === -1)
      continue
    const k = trimmed.slice(0, eq).trim()
    const v = trimmed.slice(eq + 1).trim()
    if (k)
      out[k] = v
  }
  return out
}

/**
 * Extract the most plausible client IP from a Request.
 */
function clientIp(req: Request): string {
  const fwd = req.headers.get('x-forwarded-for')
  if (fwd)
    return fwd.split(',')[0]?.trim() ?? '127.0.0.1'
  const real = req.headers.get('x-real-ip')
  if (real)
    return real
  return '127.0.0.1'
}

/**
 * Single source of truth for the maintenance / coming-soon gate.
 *
 * Returns a `Response` to short-circuit the request, or `null` to let
 * normal request handling continue.
 *
 * Used by:
 *   - the dev server's `onRequest` hook (so the gate runs before the
 *     stx-serve view router or the API proxy ever sees the request);
 *   - the global `Maintenance` middleware in production.
 *
 * Order of checks (mirrors Laravel):
 *   1. No active site-mode (no down file, no coming-soon file, no env
 *      override) → pass through.
 *   2. Path is always-allowed (the holding page itself, email
 *      subscribe, static assets) → pass through.
 *   3. Path matches the secret token → set mode-aware bypass cookie,
 *      redirect home (coming-soon lands on `/?preview=<secret>` so the
 *      client-side gate unlocks in the same visit when tokens match).
 *   4. Bypass cookie present OR client IP allowed → pass through.
 *   5. Otherwise → return the active mode's response (redirect for
 *      coming-soon when a redirect URL is configured; HTML page for
 *      maintenance).
 */
export function maintenanceGate(req: Request): Response | null | Promise<Response | null> {
  const payloadResult = activeSiteModePayloadResult()
  return payloadResult instanceof Promise
    ? payloadResult.then(payload => applyMaintenanceGate(req, payload))
    : applyMaintenanceGate(req, payloadResult)
}

function applyMaintenanceGate(req: Request, payload: MaintenancePayload | null): Response | null {
  if (!payload)
    return null

  const mode: SiteMode = payload.mode ?? 'maintenance'
  const url = new URL(req.url)
  const path = url.pathname

  if (isAlwaysAllowed(path))
    return null

  // Secret bypass URL: visiting `/the-secret` sets the bypass cookie
  // and bounces the visitor to home (or to the page they wanted).
  // In coming-soon mode the landing URL carries `?preview=<secret>` so the
  // client-side site-mode gate (resources/assets/scripts/site-mode.js)
  // unlocks in the same visit when its token matches the server secret;
  // the script strips the param from the address bar afterwards.
  if (payload.secret && isSecretPath(path, payload.secret)) {
    const location = mode === 'coming-soon'
      ? `/?preview=${encodeURIComponent(payload.secret)}`
      : '/'

    return new Response(null, {
      status: 302,
      headers: {
        'Location': location,
        'Set-Cookie': bypassCookieValue(payload.secret, mode),
      },
    })
  }

  const cookies = parseCookieHeader(req.headers.get('cookie'))
  const hasCookie = !!payload.secret && hasValidBypassCookie(cookies, payload.secret, mode)
  const appEnv = (process.env.APP_ENV || process.env.NODE_ENV || '').toLowerCase()
  const trustLocalhost = !['production', 'staging'].includes(appEnv)
  const ipAllowed = isAllowedIp(clientIp(req), payload.allowed, trustLocalhost)

  if (hasCookie || ipAllowed)
    return null

  return siteModeResponse(payload)
}
