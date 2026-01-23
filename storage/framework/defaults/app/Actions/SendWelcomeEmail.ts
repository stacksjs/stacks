import { Action } from '@stacksjs/actions'
import { config } from '@stacksjs/config'
import { mail } from '@stacksjs/email'

export interface WelcomeEmailParams {
  to: string
  name?: string
}

export default new Action({
  name: 'SendWelcomeEmail',
  description: 'Sends a welcome email to newly registered users',

  async handle({ to, name }: WelcomeEmailParams) {
    const appName = config.app.name || 'our app'
    const url = config.app.url || 'https://localhost:5173'

    await mail.send({
      to,
      subject: `Welcome to ${appName}!`,
      text: `
Hello ${name || 'there'},

Welcome to ${appName}! We're excited to have you on board.

You can access your account at ${url}

If you have any questions, feel free to reach out to our support team.

Best regards,
The ${appName} Team
      `.trim(),
    })

    return {
      success: true,
      message: `Welcome email sent to ${to}`,
    }
  },
})
