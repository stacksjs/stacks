import { Action } from '@stacksjs/actions'
import { config } from '@stacksjs/config'
import { response } from '@stacksjs/router'

/**
 * /robots.txt — sensible defaults for any Stacks app.
 *
 * Allow everything by default, then disallow the surfaces a search
 * engine has no reason to see: cart/checkout/orders are transactional,
 * dashboard/admin/auth are private, and /api endpoints return JSON
 * (not useful in search indices).
 *
 * Apps that want stricter rules can re-register `/robots.txt` in
 * `routes/api.ts` against their own action — user routes load before
 * framework routes so the override wins.
 */
export default new Action({
  name: 'RobotsAction',
  description: 'Generate /robots.txt with safe defaults + sitemap link',
  method: 'GET',

  async handle() {
    // Normalize APP_URL the same way SitemapAction does — Stacks .env
    // files commonly carry `APP_URL=foo.localhost` without a scheme
    // because the dev proxy bolts on https:// at runtime, but a
    // robots.txt `Sitemap: …` entry needs an explicit absolute URL or
    // search engines won't discover the sitemap.
    let siteUrl = ((config as any).app?.url || 'http://localhost:3000').trim().replace(/\/$/, '')
    if (!/^https?:\/\//i.test(siteUrl))
      siteUrl = `https://${siteUrl}`

    const lines = [
      'User-agent: *',
      'Allow: /',
      // Transactional, ephemeral, or per-user surfaces — never useful in
      // a search index, and crawling them wastes budget.
      'Disallow: /cart',
      'Disallow: /checkout',
      'Disallow: /orders',
      // Auth endpoints + private admin
      'Disallow: /login',
      'Disallow: /register',
      'Disallow: /logout',
      'Disallow: /me',
      'Disallow: /admin',
      'Disallow: /dashboard',
      // JSON APIs and framework internals — no human-readable content.
      'Disallow: /api/',
      'Disallow: /auth/',
      'Disallow: /_stx/',
      'Disallow: /voide/',
      '',
      `Sitemap: ${siteUrl}/sitemap.xml`,
      '',
    ]

    return response.text(lines.join('\n'), 200, {
      'Cache-Control': 'public, max-age=86400',
    })
  },
})
