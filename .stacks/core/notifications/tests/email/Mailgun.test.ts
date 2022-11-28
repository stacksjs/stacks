import { assert, describe, it } from 'vitest'
import { email as Notification } from '@stacksjs/notifications'

describe('Mailgun Test', () => {
  it('should send email successfully', async () => {
    await (Notification.send({

    }))
  })
})
