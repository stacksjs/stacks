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

import { log } from '@stacksjs/logging'
import * as p from '@stacksjs/path'

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
  message: 'Stacks is setting up camp. Check back soon for the public launch.',
}

function defaultsForMode(mode: SiteMode): Partial<MaintenancePayload> {
  return mode === 'coming-soon' ? DEFAULT_COMING_SOON_PAYLOAD : DEFAULT_MAINTENANCE_PAYLOAD
}

/**
 * Get the path to the maintenance file
 */
export function maintenanceFilePath(): string {
  return p.storagePath('framework/down')
}

export function comingSoonFilePath(): string {
  return p.storagePath('framework/coming-soon')
}

export function siteModeFilePath(mode: SiteMode): string {
  return mode === 'coming-soon' ? comingSoonFilePath() : maintenanceFilePath()
}

/**
 * Check if the application is in maintenance mode
 */
export async function isDownForMaintenance(): Promise<boolean> {
  try {
    const file = Bun.file(maintenanceFilePath())
    return await file.exists()
  }
  catch {
    return false
  }
}

export async function isComingSoon(): Promise<boolean> {
  try {
    const file = Bun.file(comingSoonFilePath())
    return await file.exists()
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

export async function siteModePayload(mode: SiteMode): Promise<MaintenancePayload | null> {
  try {
    const file = Bun.file(siteModeFilePath(mode))

    if (!(await file.exists())) {
      return null
    }

    const content = await file.text()
    return {
      ...defaultsForMode(mode),
      ...JSON.parse(content),
      mode,
    } as MaintenancePayload
  }
  catch {
    return null
  }
}

export async function activeSiteModePayload(): Promise<MaintenancePayload | null> {
  return (await maintenancePayload()) ?? (await comingSoonPayload()) ?? envSiteModePayload()
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
  return ['1', 'true', 'yes', 'on'].includes(String(value || '').toLowerCase())
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
export function isAllowedIp(ip: string, allowed: string[] = []): boolean {
  if (allowed.length === 0) {
    return false
  }

  // Always allow localhost
  const localhostIps = ['127.0.0.1', '::1', 'localhost']
  if (localhostIps.includes(ip)) {
    return true
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
 */
export function maintenanceHtml(payload: MaintenancePayload): string {
  const mode = payload.mode ?? 'maintenance'
  const defaults = defaultsForMode(mode)
  const message = escapeHtml(payload.message || defaults.message || '')
  const title = escapeHtml(payload.title || (mode === 'coming-soon' ? 'Opening Soon' : 'Trail Maintenance'))
  const eyebrow = mode === 'coming-soon' ? 'Stacks basecamp' : 'Service notice'
  const lead = mode === 'coming-soon'
    ? 'The public trailhead is almost ready.'
    : 'The route is temporarily closed while the crew improves the path.'

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    @font-face {
      font-display: swap;
      font-family: "Campmate Script";
      src: url("/assets/fonts/nps/CampmateScript-Regular.woff2") format("woff2");
    }
    @font-face {
      font-display: swap;
      font-family: "Switchback";
      src: url("/assets/fonts/nps/Switchback-Regular.woff2") format("woff2");
    }
    @font-face {
      font-display: swap;
      font-family: "NPS 2026";
      font-weight: 100 900;
      src: url("/assets/fonts/nps/NPS_2026-variable.woff2") format("woff2");
    }
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: "Switchback", ui-sans-serif, system-ui, sans-serif;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background:
        linear-gradient(180deg, rgba(10, 28, 18, 0.78), rgba(10, 28, 18, 0.94)),
        url("/assets/images/topography.svg") center / 760px auto,
        #0d1e16;
      color: #fff7e1;
      padding: 20px;
    }
    .container {
      position: relative;
      width: min(760px, 100%);
      overflow: hidden;
      border: 1px solid rgba(255, 240, 200, 0.28);
      border-top: 6px solid #df9a2f;
      border-radius: 8px;
      padding: clamp(2rem, 7vw, 4.5rem);
      background:
        linear-gradient(180deg, rgba(27, 65, 40, 0.86), rgba(12, 31, 21, 0.96)),
        #163824;
      box-shadow: 0 30px 80px rgba(0, 0, 0, 0.38);
    }
    .container::after {
      position: absolute;
      inset: auto 0 0;
      height: 44%;
      content: "";
      background: url("/assets/images/park-ridge.svg") center bottom / cover no-repeat;
      opacity: 0.34;
      pointer-events: none;
    }
    .eyebrow {
      position: relative;
      z-index: 1;
      display: flex;
      gap: .75rem;
      align-items: center;
      color: #aac47d;
      font-family: "Switchback", ui-sans-serif, system-ui, sans-serif;
      font-size: .9rem;
      font-weight: 800;
      text-transform: uppercase;
    }
    .eyebrow::before {
      width: 44px;
      height: 2px;
      content: "";
      background: #df9a2f;
    }
    h1 {
      position: relative;
      z-index: 1;
      margin-top: 1rem;
      font-family: "Campmate Script", ui-serif, Georgia, serif;
      font-size: clamp(4.5rem, 16vw, 8rem);
      font-weight: 400;
      line-height: .82;
    }
    .lead,
    .message,
    .retry {
      position: relative;
      z-index: 1;
      max-width: 560px;
      color: rgba(255, 247, 225, .84);
      font-size: 1.08rem;
      line-height: 1.65;
    }
    .lead {
      margin-top: 1.25rem;
      color: #b8d9cf;
      font-family: "NPS 2026", "Switchback", ui-sans-serif, system-ui, sans-serif;
      font-size: 1.22rem;
      font-weight: 850;
      line-height: 1.3;
      text-transform: uppercase;
    }
    .message {
      margin-top: .75rem;
    }
    .retry {
      margin-top: 1.4rem;
      color: #aac47d;
      font-family: "Switchback", ui-sans-serif, system-ui, sans-serif;
      font-size: .95rem;
      font-weight: 800;
      text-transform: uppercase;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="eyebrow">${eyebrow}</div>
    <h1>${title}</h1>
    <p class="lead">${lead}</p>
    <p class="message">${message}</p>
    ${payload.retry ? `<p class="retry">Estimated reopening: ${Math.ceil(payload.retry / 60)} minutes.</p>` : ''}
  </div>
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
