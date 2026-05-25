import process from 'node:process'
import { route } from '@stacksjs/router'

/**
 * Framework routes shared by every Stacks app.
 *
 * User routes load first — defining the same path in `routes/web.ts` or
 * `routes/api.ts` overrides these defaults.
 */
route.get('/locale/{locale}', 'Actions/Locale/SetLocaleAction')

// robots.txt — block crawler indexing on non-production envs so staging /
// preview deploys don't end up in search results (stacksjs/stacks#1077).
// APP_ENV wins over NODE_ENV because Stacks apps key everything off APP_ENV.
// Define a `/robots.txt` route in your own routes to override.
route.get('/robots.txt', () => {
  const env = (process.env.APP_ENV ?? process.env.NODE_ENV ?? '').toLowerCase()
  const body = env === 'production'
    ? 'User-agent: *\nAllow: /\n'
    : 'User-agent: *\nDisallow: /\n'
  return new Response(body, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  })
}).skipCsrf()
