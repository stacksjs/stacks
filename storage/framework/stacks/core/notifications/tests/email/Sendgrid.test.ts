// import { email, useEmail } from '@stacksjs/notifications'
// import { notification as env } from '@stacksjs/config'
//
// describe('Sendgrid Test', () => {
//   it('should send email', async () => {
//     const notification = email.sendgrid
//     const test = await notification.send({
//       from: env.email.sendgrid.from,
//       to: 'chris@stacksjs.org',
//       subject: 'Test Email',
//       html: '<p> Test Email using SG!</p>',
//     })
//
//     expect(test).toBeDefined()
//   })
//
//   it('should send email using useEmail', async () => {
//     const notification = useEmail('sendgrid')
//     const test = await notification.send({
//       from: env.email.sendgrid.from,
//       to: 'chris@stacksjs.org',
//       subject: 'Test Email',
//       html: '<p> Test Email using SG!</p>',
//     })
//
//     expect(test).toBeDefined()
//   })
//
//   it('should not send email when receiver is empty', async () => {
//     const notification = email.sendgrid
//     const test = await notification.send({
//       from: env.email.sendgrid.from,
//       to: '',
//       subject: 'Test Email',
//       html: '<p> Test Email using SG!</p>',
//     })
//
//     expect(test.error).toThrowError(Error)
//   })
// })
