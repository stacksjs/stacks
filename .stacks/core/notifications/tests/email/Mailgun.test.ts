import { describe, expect, it } from 'vitest'
import { email } from '@stacksjs/notifications'

describe('Mailgun Test', () => {
  it('should not send email', async () => {
    const notification = email.mailgun
    const test = await notification.send({
      from: 'repuestobrian2@gmail.com',
      to: 'repuestobrian@gmail',
      subject: 'Test Email',
      html: '<p> Test </p>',
    })

    expect(test).toBeDefined()
  })

  it('should send email using useNotification', async () => {
    const notification = useNotification().mailgun
    const test = await notification.send({
      from: 'repuestobrian2@gmail.com',
      to: 'repuestobrian@gmail',
      subject: 'Test Email',
      html: '<p> Test </p>',
    })

    expect(test).toBeDefined()
  })

  it('should not send email when receiver is empty', async () => {
    const notification = email.mailgun
    const test = await notification.send({
      from: env.email.sendgrid.from,
      to: '',
      subject: 'Test Email',
      html: '<p> Test Email using SG!</p>',
    })

    expect(test.error).toThrowError(Error)
  })
})
