import { describe, expect, it } from 'vitest'
import { chat } from '@stacksjs/notifications'  
import { notification } from '@stacksjs/config'

const notif = chat.slack

describe('Slack Test', () => {
  it('should send chat', async () => {
    let test = await notif.send({
        content: 'Test Slack Message!',
        webhookUrl: 'https://hooks.slack.com/services/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'
    })

    expect(test).toBeDefined()
  })
})
