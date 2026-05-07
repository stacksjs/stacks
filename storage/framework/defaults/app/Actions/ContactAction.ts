import { Action } from '@stacksjs/actions'
import { config } from '@stacksjs/config'
import { mail } from '@stacksjs/email'
import { rateLimit } from '@stacksjs/router'

/**
 * Default `/api/contact` handler.
 *
 * Receives a name + email + message from the public contact form and
 * forwards it to the team inbox. Rate-limited and CSRF-skipped (the
 * form is rendered as static HTML without a token round-trip), with
 * a stricter quota than `/api/email/subscribe` because each call hits
 * the outbound mailer directly.
 *
 * Apps that want a richer flow (ticketing, autoresponders, Slack
 * notifications) should override this in `app/Actions/ContactAction.ts`
 * via `./buddy publish:action ContactAction`.
 */
export default new Action({
  name: 'ContactAction',
  description: 'Forward public contact-form submissions to the team inbox',
  method: 'POST',

  async handle(request: RequestInstance) {
    // Stricter than subscribe: every accepted call sends an outbound
    // email, so abuse here directly maps to mailer cost. Five per
    // minute per IP gives a real human room to retry while a scripted
    // flood tops out fast.
    await rateLimit('contact-form', 5).per('minute')

    const name = String(request.get('name') || '').trim()
    const email = String(request.get('email') || '').trim()
    const message = String(request.get('message') || '').trim()

    if (!email.includes('@'))
      return { success: false, message: 'A valid email is required' }
    if (!message)
      return { success: false, message: 'A message is required' }

    const appName = config.app.name || 'Stacks'
    const fromAddress = config.email.from?.address || 'hello@stacksjs.com'
    // The team inbox: prefer a configured `support` address, fall
    // back to the same `from` address (safe — real apps will set both).
    const toAddress = (config.email as any)?.support?.address || fromAddress

    // Plain-text body so it lands cleanly in any inbox client. Reply-To
    // is the visitor's address so a reply goes straight back to them
    // without a copy-paste step.
    const text = [
      `From: ${name || '(no name)'} <${email}>`,
      '',
      message,
    ].join('\n')

    try {
      await mail.send({
        to: [toAddress],
        from: { name: appName, address: fromAddress },
        replyTo: email,
        subject: `[contact] ${name || email}`,
        text,
      })
    }
    catch (err) {
      const errMessage = err instanceof Error ? err.message : String(err)
      console.error('[ContactAction] mail.send failed:', errMessage)
      return { success: false, message: 'We could not send your message. Try again in a moment.' }
    }

    return { success: true }
  },
})
