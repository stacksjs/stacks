import { describe, expect, it } from 'vitest'
import { sms } from '@stacksjs/notifications'  
import { notification } from '@stacksjs/config'

const notif = sms.twilio

describe('Twilio Test', () => {
    it('should send sms', async () => {
     let test = await notif.send({
        content: 'Test SMS from Stacks',
        to: '+639086347124', // will update later
        from: notification.sms.twilio.from,
      })
  
      expect(test).toBeDefined()
    })
  })
  
  
  