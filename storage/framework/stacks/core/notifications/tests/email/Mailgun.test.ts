// import { email, useEmail } from '@stacksjs/notifications'
// import { notification as env } from '@stacksjs/utils'
//
// describe('Mailgun Test', () => {
//   it('should not send email', async () => {
//     const notification = email.mailgun
//     const test = await notification.send({
//       from: 'chris@stacksjs.org',
//       to: 'avery@stacksjs.org',
//       subject: 'Test Email',
//       html: '<p> Test </p>',
//     })
//
//     expect(test).toBeDefined()
//   })
//
//   it('should send email using useEmail', async () => {
//     const notification = useEmail('mailgun')
//     const test = await notification.send({
//       from: 'chris@stacksjs.org',
//       to: 'avery@stacksjs.org',
//       subject: 'Test Email',
//       html: '<p> Test </p>',
//     })
//
//     expect(test).toBeDefined()
//   })
//
//   it('should not send email when receiver is empty', async () => {
//     const notification = email.mailgun
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
