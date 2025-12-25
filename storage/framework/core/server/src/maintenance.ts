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

/**
 * Maintenance mode payload
 */
export interface MaintenancePayload {
  /** When maintenance mode was activated */
  time: number
  /** Optional message to display */
  message?: string
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
const DEFAULT_PAYLOAD: Partial<MaintenancePayload> = {
  status: 503,
  message: 'We are currently performing maintenance. Please check back soon.',
}

/**
 * Get the path to the maintenance file
 */
export function maintenanceFilePath(): string {
  return p.storagePath('framework/down')
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

/**
 * Get the maintenance mode payload
 */
export async function maintenancePayload(): Promise<MaintenancePayload | null> {
  try {
    const file = Bun.file(maintenanceFilePath())

    if (!(await file.exists())) {
      return null
    }

    const content = await file.text()
    return JSON.parse(content) as MaintenancePayload
  }
  catch {
    return null
  }
}

/**
 * Put the application into maintenance mode
 */
export async function down(options: Partial<MaintenancePayload> = {}): Promise<void> {
  const payload: MaintenancePayload = {
    ...DEFAULT_PAYLOAD,
    ...options,
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
    log.info(`Bypass secret: ${payload.secret}`)
    log.info(`Bypass URL: your-app.com/${payload.secret}`)
  }
}

/**
 * Bring the application out of maintenance mode
 */
export async function up(): Promise<void> {
  const { unlinkSync, existsSync } = await import('@stacksjs/storage')
  const filePath = maintenanceFilePath()

  if (existsSync(filePath)) {
    unlinkSync(filePath)
    log.info('Application is now live.')
  }
  else {
    log.info('Application is already live.')
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
export function hasValidBypassCookie(cookies: Record<string, string>, secret: string): boolean {
  const bypassCookie = cookies['stacks_maintenance_bypass']
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
  const message = payload.message || DEFAULT_PAYLOAD.message

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Maintenance Mode</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 20px;
    }
    .container {
      text-align: center;
      max-width: 600px;
    }
    .icon {
      font-size: 4rem;
      margin-bottom: 1.5rem;
    }
    h1 {
      font-size: 2rem;
      font-weight: 600;
      margin-bottom: 1rem;
    }
    p {
      font-size: 1.1rem;
      opacity: 0.9;
      line-height: 1.6;
    }
    .retry {
      margin-top: 2rem;
      font-size: 0.9rem;
      opacity: 0.7;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="icon">🔧</div>
    <h1>Under Maintenance</h1>
    <p>${message}</p>
    ${payload.retry ? `<p class="retry">We'll be back in approximately ${Math.ceil(payload.retry / 60)} minutes.</p>` : ''}
  </div>
</body>
</html>`
}

/**
 * Create a maintenance mode response
 */
export function maintenanceResponse(payload: MaintenancePayload): Response {
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
    status: payload.status || 503,
    headers,
  })
}

/**
 * Create bypass cookie
 */
export function bypassCookieValue(secret: string): string {
  return `stacks_maintenance_bypass=${secret}; Path=/; HttpOnly; SameSite=Lax`
}
