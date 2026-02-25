import { Action } from '@stacksjs/actions'
import { Subscriber } from '@stacksjs/orm'

export default new Action({
  name: 'UnsubscribeAction',
  description: 'Handle email unsubscription via token (subscriber UUID)',
  method: 'GET',

  async handle(request: RequestInstance) {
    const token = request.get('token')

    if (!token) {
      return new Response(unsubscribePage('Missing token', 'The unsubscribe link is invalid.', false), {
        headers: { 'Content-Type': 'text/html' },
      })
    }

    try {
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

      // Update subscriber status
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

function unsubscribePage(title: string, message: string, success: boolean): string {
  const icon = success ? '&#10003;' : '&#10007;'
  const iconColor = success ? '#22c55e' : '#ef4444'

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #0e0e0e; color: #d4d4d4; display: flex; align-items: center; justify-content: center; min-height: 100vh;">
  <div style="max-width: 480px; margin: 0 auto; padding: 40px 20px; text-align: center;">
    <div style="width: 64px; height: 64px; border-radius: 50%; background-color: ${iconColor}20; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 24px;">
      <span style="font-size: 28px; color: ${iconColor};">${icon}</span>
    </div>
    <h1 style="color: #ececec; font-size: 24px; font-weight: 600; margin: 0 0 12px;">${title}</h1>
    <p style="color: #a0a0a0; font-size: 16px; line-height: 1.6; margin: 0 0 32px;">${message}</p>
    <a href="https://stacksjs.com" style="color: #888; font-size: 13px; text-decoration: none;">stacksjs.com</a>
  </div>
</body>
</html>`
}
