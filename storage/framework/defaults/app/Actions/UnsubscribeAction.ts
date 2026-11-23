import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions/runtime'
import { config } from '@stacksjs/config'
import { EmailList, EmailListSubscriber, Subscriber } from '@stacksjs/orm'

export default new Action({
  name: 'UnsubscribeAction',
  description: 'Handle email unsubscription via token (subscriber UUID or per-list pivot UUID)',
  method: 'GET',

  async handle(request: RequestInstance) {
    const token = request.get('token')

    if (!token) {
      return new Response(unsubscribePage('Missing token', 'The unsubscribe link is invalid.', false), {
        headers: { 'Content-Type': 'text/html' },
      })
    }

    // Two flavors of token can land here:
    //   1. EmailListSubscriber.uuid → per-list (newsletter) unsubscribe.
    //      We only flip this one row; other lists + transactional mail
    //      keep flowing.
    //   2. Subscriber.uuid → legacy global unsubscribe (drops every list).
    //
    // We try the per-list pivot first because it's the safer scope —
    // if a recipient kept an old link around, we'd rather honor it as
    // a single-list unsubscribe than nuke their entire subscription.
    // UUIDs are universally unique so the lookups never collide.
    try {
      const pivot = await EmailListSubscriber.where('uuid', token).first()

      if (pivot) {
        const subscriber = await Subscriber.find(pivot.subscriber_id)
        const list = await EmailList.find(pivot.email_list_id)
        const listName = list?.name ?? 'this list'

        if (pivot.status === 'unsubscribed') {
          return new Response(unsubscribePage('Already unsubscribed', `${subscriber?.email ?? 'You'} has already been unsubscribed from ${listName}.`, true), {
            headers: { 'Content-Type': 'text/html' },
          })
        }

        await pivot.update({
          status: 'unsubscribed',
          unsubscribed_at: new Date().toISOString(),
        })

        return new Response(unsubscribePage('Unsubscribed', `${subscriber?.email ?? 'You'} has been successfully unsubscribed from ${listName}. You will no longer receive emails from this list.`, true), {
          headers: { 'Content-Type': 'text/html' },
        })
      }

      const subscriber = await Subscriber.where('uuid', token).first()

      if (!subscriber) {
        return new Response(unsubscribePage('Invalid link', 'This unsubscribe link is invalid or has already been used.', false), {
          headers: { 'Content-Type': 'text/html' },
        })
      }

      if (subscriber.status === 'unsubscribed') {
        return new Response(unsubscribePage('Already unsubscribed', `${subscriber.email} has already been unsubscribed.`, true), {
          headers: { 'Content-Type': 'text/html' },
        })
      }

      await subscriber.update({
        status: 'unsubscribed',
        unsubscribed_at: new Date().toISOString(),
      })

      return new Response(unsubscribePage('Unsubscribed', `${subscriber.email} has been successfully unsubscribed. You will no longer receive emails from us.`, true), {
        headers: { 'Content-Type': 'text/html' },
      })
    }
    catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error)
      console.error('Unsubscribe error:', message)
      return new Response(unsubscribePage('Error', 'Something went wrong. Please try again later.', false), {
        headers: { 'Content-Type': 'text/html' },
      })
    }
  },
})

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', '\'': '&#39;' }[c]!))
}

/**
 * The page an unsubscribe link lands on.
 *
 * It names the app the visitor subscribed to, from config, rather than
 * stacksjs.com, which every app using this default used to print. The
 * message carries the subscriber's stored address, so everything is escaped.
 */
function unsubscribePage(title: string, message: string, success: boolean): string {
  const appName = escapeHtml(config.app?.name || 'Home')
  const rawUrl = String(config.app?.url || '/')
  const appUrl = escapeHtml(/^https?:\/\//.test(rawUrl) || rawUrl.startsWith('/') ? rawUrl : `https://${rawUrl}`)
  const accent = success ? '#1747c9' : '#dc2626'
  const icon = success ? '&#10003;' : '&#33;'

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="robots" content="noindex">
  <meta name="color-scheme" content="light dark">
  <title>${escapeHtml(title)} - ${appName}</title>
  <style>
    :root { --bg: #f6f7f9; --card: #ffffff; --text: #0b1220; --muted: #4a5468; --line: rgba(11, 18, 32, 0.1); }
    @media (prefers-color-scheme: dark) { :root { --bg: #070b14; --card: #0d1322; --text: #e8edf7; --muted: #9ba7be; --line: rgba(232, 237, 247, 0.1); } }
    * { box-sizing: border-box; }
    body { margin: 0; min-height: 100vh; display: grid; place-items: center; padding: 24px; background: var(--bg); color: var(--text); font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; }
    main { width: min(440px, 100%); padding: 40px 32px; border: 1px solid var(--line); border-radius: 16px; background: var(--card); text-align: center; }
    .icon { display: inline-grid; place-items: center; width: 56px; height: 56px; margin-bottom: 20px; border-radius: 50%; color: ${accent}; font-size: 24px; font-weight: 700; background: ${accent}1a; }
    h1 { margin: 0 0 10px; font-size: 22px; letter-spacing: -0.01em; }
    p { margin: 0 0 28px; color: var(--muted); font-size: 15px; line-height: 1.6; overflow-wrap: anywhere; }
    a { display: inline-block; padding: 11px 20px; border-radius: 10px; color: #fff; font-size: 14px; font-weight: 600; text-decoration: none; background: #1747c9; }
  </style>
</head>
<body>
  <main>
    <div class="icon" aria-hidden="true">${icon}</div>
    <h1>${escapeHtml(title)}</h1>
    <p>${escapeHtml(message)}</p>
    <a href="${appUrl}">Back to ${appName}</a>
  </main>
</body>
</html>`
}
