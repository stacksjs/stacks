import { describe, expect, it } from 'vitest'
import { sms } from '@stacksjs/notifications'
import { notification } from '@stacksjs/config'

const notif = sms.twilio

describe('Twilio Test', () => {
  it('should send sms', async () => {
    const test = await notif.send({
      content: 'Test SMS from Stacks',
      to: notification.sms.twilio.to,
      from: notification.sms.twilio.from,
    })

    expect(test).toBeDefined()
  })
})
