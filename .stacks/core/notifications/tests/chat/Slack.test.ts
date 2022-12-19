import { describe, expect, it } from 'vitest'
import { chat } from '@stacksjs/notifications'

describe('Slack Test', () => {
  it('should send chat', async () => {
    const notification = chat.slack
    const test = await notification.send({
      content: 'Test Slack Message!',
      webhookUrl: 'https://hooks.slack.com/services/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',
    })

    expect(test).toBeDefined()
  })

  it('should send chat using useNotification', async () => {
    const notification = useNotification('chat').slack
    const test = await notification.send({
      content: 'Test Slack Message!',
      webhookUrl: 'https://hooks.slack.com/services/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',
    })

    expect(test).toBeDefined()
  })

  it('should not send chat if webhook is empty', async () => {
    const notification = chat.slack
    const test = await notification.send({
      content: 'Test Slack Message!',
      webhookUrl: '',
    })

    expect(test.error).toThrowError()
  })
})
