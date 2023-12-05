import { Action } from 'stacks:actions'

export default new Action({
  name: 'SendWelcomeEmail',
  description: 'Send a welcome email to a new user',
  async handle() {
    // Send the email
    await sendEmail({
      to: 'some@recipient.com',
      subject: 'Welcome to our app!',
      text: 'We are excited to have you here.',
    })

    // Return a message
    return `Welcome email sent to ${email}`
  },
})

function sendEmail({ to, subject, text }: { to: string; subject: string; text: string }) {
  log.info('Sending email', { to, subject, text })
  return Promise.resolve()
}
