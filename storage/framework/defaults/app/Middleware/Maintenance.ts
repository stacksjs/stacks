import { Middleware } from '@stacksjs/router'

/**
 * Maintenance / Coming-Soon Middleware
 *
 * Global middleware that gates every request when the application has
 * been flipped into a protected site mode via either:
 *
 *   - `buddy down` / `buddy up` (maintenance mode), or
 *   - `buddy coming-soon` / `buddy launch` (coming-soon mode), or
 *   - the `APP_MAINTENANCE` / `APP_COMING_SOON` env vars in production.
 *
 * All gate logic — mode detection, secret-URL bypass, mode-aware bypass
 * cookies, allowed IPs, always-allowed paths (the holding page itself,
 * email subscribe, static assets) — lives in one place:
 * `maintenanceGate()` in `@stacksjs/server`. The dev server's
 * `onRequest` hook calls the same function, so dev and prod behave
 * identically.
 *
 * Bypass methods:
 *   1. Secret URL — visit `/your-secret` to set a bypass cookie.
 *   2. Allowed IPs — configured with `--allow=IP` on either command.
 *   3. Bypass cookie — automatically set when visiting the secret URL.
 */
export default new Middleware({
  name: 'maintenance',
  priority: 0, // Run first, before all other middleware

  async handle(request) {
    const { maintenanceGate } = await import('@stacksjs/server')

    const gated = await maintenanceGate(request)
    if (gated)
      throw gated // short-circuit the request
  },
})
