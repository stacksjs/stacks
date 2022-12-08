import { describe, expect, it } from 'vitest'
import { email } from '@stacksjs/notifications'

const notification = email.mailgun

describe('Mailgun Test', () => {
  it('should not send email', async () => {
    const test = await notification.send({
      from: 'repuestobrian2@gmail.com',
      to: 'repuestobrian@gmail',
      subject: 'Test Email',
      html: '<p> Test </p>',
    })

    expect(test.error).toThrowError(Error)
  })
})

