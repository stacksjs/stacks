import { Action } from '@stacksjs/actions'

export interface WelcomeEmailParams {
  to: string
  name?: string
}

export default new Action({
  name: 'SendWelcomeEmail',
  description: 'Sends a welcome email to newly registered users',

  async handle({ to, name }: WelcomeEmailParams) {
    const appName = 'Stacks'

    // TODO: integrate with @stacksjs/email when configured
    console.log(`[SendWelcomeEmail] Sending welcome email to ${to} (${name || 'user'}) for ${appName}`)

    return {
      success: true,
      message: `Welcome email sent to ${to}`,
    }
  },
})
