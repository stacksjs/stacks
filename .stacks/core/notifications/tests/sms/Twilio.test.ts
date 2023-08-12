// import { sms, useSMS } from '@stacksjs/notifications'
// import notification from '~/config/notification'
//
// describe('Twilio Test', () => {
//   it('should send sms', async () => {
//     const notif = sms.twilio
//     const test = await notif.send({
//       content: 'Test SMS from Stacks',
//       to: notification.sms.twilio.to,
//       from: notification.sms.twilio.from,
//     })
//
//     expect(test).toBeDefined()
//   })
//
//   it('should send sms using useSMS', async () => {
//     const notif = useSMS('twilio')
//     const test = await notif.send({
//       content: 'Test SMS from Stacks',
//       to: notification.sms.twilio.to,
//       from: notification.sms.twilio.from,
//     })
//
//     expect(test).toBeDefined()
//   })
//
//   it('should not send sms if receiver is empty', async () => {
//     const notif = sms.twilio
//     const test = await notif.send({
//       content: 'Test SMS from Stacks',
//       to: '',
//       from: notification.sms.twilio.from,
//     })
//
//     expect(test.error).toThrowError(Error)
//   })
// })
