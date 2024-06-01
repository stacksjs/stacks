import { Action } from '@stacksjs/actions'

export default new Action({
  name: 'SendWelcomeEmail',
  description: 'An optional description of the action.',

  async handle() {
    return sendEmail({
      to: 'some@recipient.com',
      subject: 'Welcome to our app!',
      text: 'We are excited to have you here.',
    })
  },
})

function sendEmail({ to, subject, text }: { to: string; subject: string; text: string }) {
  log.info('Sending email', { to, subject, text })
  return `Welcome email sent to ${email}`
}
