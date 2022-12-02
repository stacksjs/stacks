import { describe, it } from 'vitest'
import { mailgun } from '../../src/drivers/email'

const notification = mailgun

console.log(notification)
describe('Mailgun Test', () => {
  it('should send email', async () => {

    // await notification.send({

    // })
  })
})
