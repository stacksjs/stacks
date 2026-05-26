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

// Mailable preview routes (stacksjs/stacks#1900 A3) — dev-only HTML
// pages that render every Mailable in `app/Mail/` with sample props
// from `resources/emails/_previews/<slug>.ts`. Production deployments
// short-circuit to 404 so even an accidental route registration in
// prod can't leak the preview surface.
function isProduction(): boolean {
  const env = (process.env.APP_ENV ?? process.env.NODE_ENV ?? '').toLowerCase()
  return env === 'production'
}

function notFound(): Response {
  return new Response('Not Found', { status: 404 })
}

route.get('/_stacks/mail/preview', async () => {
  if (isProduction()) return notFound()
  const { discoverMailables, renderIndexHtml } = await import('@stacksjs/email')
  return new Response(renderIndexHtml(discoverMailables()), {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  })
}).skipCsrf()

route.get('/_stacks/mail/preview/{name}', async (req: any) => {
  if (isProduction()) return notFound()
  const { discoverMailables, renderMailablePreview, renderPreviewHtml } = await import('@stacksjs/email')
  const slug = String(req?.params?.name ?? '')
  const mailable = discoverMailables().find(m => m.slug === slug)
  if (!mailable) return notFound()
  const preview = await renderMailablePreview(mailable)
  const url = new URL(req.url)
  const view = url.searchParams.get('view')
  const variant: 'desktop' | 'mobile' | 'text'
    = view === 'mobile' ? 'mobile' : view === 'text' ? 'text' : 'desktop'
  return new Response(renderPreviewHtml(mailable, preview, variant), {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  })
}).skipCsrf()

// Raw rendered body for the preview-page iframe — same handler shape
// but skips the surrounding UI chrome so the iframe renders only the
// email body itself. Returning text/html lets the browser style it
// natively without our outer stylesheet leaking in.
route.get('/_stacks/mail/preview/{name}/raw', async (req: any) => {
  if (isProduction()) return notFound()
  const { discoverMailables, renderMailablePreview } = await import('@stacksjs/email')
  const slug = String(req?.params?.name ?? '')
  const mailable = discoverMailables().find(m => m.slug === slug)
  if (!mailable) return notFound()
  const preview = await renderMailablePreview(mailable)
  return new Response(preview.html || '<!DOCTYPE html><html><body><p style="font-family:sans-serif;color:#6b7280;padding:40px;text-align:center">No HTML body — try the Text tab.</p></body></html>', {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  })
}).skipCsrf()
