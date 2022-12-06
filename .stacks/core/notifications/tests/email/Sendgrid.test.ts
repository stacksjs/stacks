import { describe, expect, it } from 'vitest'
import { email } from '@stacksjs/notifications'  
import { notification as env } from '@stacksjs/config'

const notification = email.sendgrid

describe('Sendgrid Test', () => {
  it('should send email', async () => {
   let test = await notification.send({
      from: env.email.sendgrid.from,
      to: 'repuestobrian2@gmail.com',
      subject: 'Test Email',
      html: '<p> Test </p>'
    })

    expect(test).toBeDefined()
  })
})



