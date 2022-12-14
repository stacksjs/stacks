import { describe, expect, it } from 'vitest'
import { email } from '@stacksjs/notifications'
import { notification as env } from '@stacksjs/config'

const notification = email.sendgrid

describe('Sendgrid Test', () => {
  it('should send email', async () => {
    const test = await notification.send({
      from: env.email.sendgrid.from,
      to: 'repuestobrian2@gmail.com',
      subject: 'Test Email',
      html: '<p> Test Email using SG!</p>',
    })
    
    expect(test).toBeDefined()
  })

  it('should not send email when receiver is empty', async () => {
    const test = await notification.send({
      from: env.email.sendgrid.from,
      to: '',
      subject: 'Test Email',
      html: '<p> Test Email using SG!</p>',
    })

    expect(test.error).toThrowError(Error)
  })
})

