export class NodemailerDriver {
  async send(): Promise<void> {
    throw new Error('Nodemailer driver is not yet implemented. Use smtp, ses, sendgrid, mailgun, or mailtrap instead.')
  }
}
