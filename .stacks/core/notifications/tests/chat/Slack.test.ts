// import { chat, useChat } from '@stacksjs/notifications'
// import { Err } from '@stacksjs/types'
//
// describe('Slack Test', () => {
//   it('should send chat', async () => {
//     const notification = chat.slack
//     const test = await notification.send({
//       content: 'Test Slack Message!',
//       webhookUrl: 'https://hooks.slack.com/services/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',
//     })
//
//     expect(test).toBeDefined()
//   })
//
//   it('should send chat using useChat', async () => {
//     const notification = useChat('slack')
//     const test = await notification.send({
//       content: 'Test Slack Message!',
//       webhookUrl: 'https://hooks.slack.com/services/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',
//     })
//
//     expect(test).toBeDefined()
//   })
//
//   it('should not send chat if webhook is empty', async () => {
//     const notification = chat.slack
//     const test = await notification.send({
//       content: 'Test Slack Message!',
//       webhookUrl: '',
//     })
//
//     expect(test).toBeInstanceOf(Err)
//   })
// })
