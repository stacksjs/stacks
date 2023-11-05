class Action {
  name: string
  description: string
  handle: () => Promise<string>

  constructor({ name, description, handle }: { name: string; description: string; handle: () => Promise<string> }) {
    this.name = name
    this.description = description
    this.handle = handle
  }
}

function sendEmail({ to, subject, text }: { to: string; subject: string; text: string }) {
  // Send the email
  return Promise.resolve()
}

export default new Action({
  name: 'SendWelcomeEmail',
  description: 'Send a welcome email to a new user',
  async handle() {
    // Send the email
    await sendEmail({
      to: email,
      subject: 'Welcome to our app!',
      text: 'Welcome to our app! We are excited to have you here.',
    })

    // Return a message
    return `Welcome email sent to ${email}`
  },
})
