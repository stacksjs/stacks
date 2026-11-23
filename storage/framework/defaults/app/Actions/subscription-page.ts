import { config } from '@stacksjs/config'

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', '\'': '&#39;' }[c]!))
}

/**
 * The page an unsubscribe or confirmation link lands on.
 *
 * It names the app the visitor subscribed to, from config, rather than
 * stacksjs.com, which every app using this default used to print. The
 * message carries the subscriber's stored address, so everything is escaped.
 */
export function subscriptionPage(title: string, message: string, success: boolean): string {
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
