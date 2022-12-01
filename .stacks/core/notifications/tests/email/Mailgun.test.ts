import { assert, describe, it } from 'vitest'
import { email } from '@stacksjs/notifications'

const Notification = email.mailgun

describe('Mailgun Test', () => {
  it('should send email', async () => {
    await Notification.send({

    })
  })

  it('should not send email', async () => {
    await Notification.send({

    })
  })
})
