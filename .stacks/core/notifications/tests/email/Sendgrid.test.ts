import { describe, expect, it } from 'vitest'
import { email } from '@stacksjs/notifications'  

const notification = email.sendgrid

describe('Sendgrid Test', () => {
  it('should not send email', async () => {
   let test = await notification.send({
      from: 'repuestobrian2@gmail.com',
      to: 'repuestobrian@gmail',
      subject: 'Test Email',
      html: '<p> Test </p>'
    })

    expect(test.error).toThrowError(Error)
  })
})



