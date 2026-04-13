import { Action } from '@stacksjs/actions'
import { mail, template } from '@stacksjs/email'
import { log } from '@stacksjs/logging'

export default new Action({
  name: 'SendWelcomeEmail',
  description: 'Sends a welcome email to newly registered users',

  async handle(request) {
    const to = request.get('to')
    const name = request.get('name') || 'there'

    log.debug(`[action] Sending welcome email to ${to}`)

    const { html, text } = await template('welcome', {
      subject: 'Welcome!',
      variables: { name, email: to },
    })

    await mail.send({
      to,
      subject: 'Welcome to Stacks!',
      html,
      text,
    })

    log.info(`[action] Welcome email sent to ${to}`)

    return {
      success: true,
      message: `Welcome email sent to ${to}`,
    }
  },
})
