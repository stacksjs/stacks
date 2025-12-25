import type { Request } from '@stacksjs/router'

import { Middleware } from '@stacksjs/router'

/**
 * Maintenance Mode Middleware
 *
 * Checks if the application is in maintenance mode and handles
 * bypass logic for allowed IPs, secret tokens, and cookies.
 *
 * This middleware should be applied globally to check all requests.
 *
 * Bypass methods:
 * 1. Secret URL: Visit /your-secret to get a bypass cookie
 * 2. Allowed IPs: Configured when running `buddy down --allow=IP`
 * 3. Bypass cookie: Automatically set when visiting secret URL
 */
export default new Middleware({
  name: 'maintenance',
  priority: 0, // Run first, before all other middleware

  async handle(request: Request) {
    const {
      isDownForMaintenance,
      maintenancePayload,
      maintenanceResponse,
      isAllowedIp,
      hasValidBypassCookie,
      isSecretPath,
      bypassCookieValue,
    } = await import('@stacksjs/server')

    // Check if in maintenance mode
    if (!(await isDownForMaintenance())) {
      return // Not in maintenance, continue normally
    }

    const payload = await maintenancePayload()

    if (!payload) {
      return // No payload, continue normally
    }

    // Get request info
    const url = new URL(request.url)
    const path = url.pathname
    const ip = getClientIp(request)
    const cookies = parseCookies(request.headers.get('cookie') || '')

    // Check if this is the secret bypass URL
    if (payload.secret && isSecretPath(path, payload.secret)) {
      // Set bypass cookie and redirect to home
      const response = new Response(null, {
        status: 302,
        headers: {
          'Location': '/',
          'Set-Cookie': bypassCookieValue(payload.secret),
        },
      })

      // Return the response to short-circuit the request
      throw response
    }

    // Check bypass conditions
    const hasValidCookie = payload.secret && hasValidBypassCookie(cookies, payload.secret)
    const isIpAllowed = isAllowedIp(ip, payload.allowed)

    if (hasValidCookie || isIpAllowed) {
      return // Bypass granted, continue normally
    }

    // No bypass - return maintenance response
    throw maintenanceResponse(payload)
  },
})

/**
 * Get client IP from request
 */
function getClientIp(request: Request): string {
  // Check common headers for proxied requests
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) {
    return forwarded.split(',')[0].trim()
  }

  const realIp = request.headers.get('x-real-ip')
  if (realIp) {
    return realIp
  }

  // Fallback (may not always be available)
  return '127.0.0.1'
}

/**
 * Parse cookies from header string
 */
function parseCookies(cookieHeader: string): Record<string, string> {
  const cookies: Record<string, string> = {}

  if (!cookieHeader) {
    return cookies
  }

  cookieHeader.split(';').forEach((cookie) => {
    const [name, ...rest] = cookie.split('=')
    if (name) {
      cookies[name.trim()] = rest.join('=').trim()
    }
  })

  return cookies
}
