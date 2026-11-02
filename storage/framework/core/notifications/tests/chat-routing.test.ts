import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'bun:test'
import { configureDiscord, configureSlack, configureTeams } from '@stacksjs/chat'
import { config } from '@stacksjs/config'
import { notify } from '../src/index'

/**
 * stacksjs/stacks#3101. The framework's CI failure notifier, runner-pressure
 * monitor and feedback notifier all call `notify({}, payload, ['chat'])`: a
 * webhook needs no recipient. Every one of those failed, and the chat channel
 * always used Slack, whatever config/notification.ts named.
 */
const notification = (config as any).notification
const saved = { tracking: notification.tracking, chat: notification.chat }
const realFetch = globalThis.fetch
let hosts: string[] = []

const DISCORD = 'https://discord.com/api/webhooks/1/test'
const SLACK = 'https://hooks.slack.com/services/T0/B0/test'
const TEAMS = 'https://prod-27.westus.logic.azure.com:443/workflows/abc/triggers/manual/paths/invoke?api-version=2016-06-01'
const payload = { subject: 'CI failed: acme/web', body: 'Conclusion: failure' }

beforeAll(() => {
  notification.tracking = { enabled: false }
})

afterAll(() => {
  notification.tracking = saved.tracking
  notification.chat = saved.chat
})

beforeEach(() => {
  hosts = []
  notification.chat = undefined
  globalThis.fetch = (async (input: any) => {
    hosts.push(new URL(String(input)).host)
    if (String(input).includes('slack.com/api/chat.postMessage'))
      return new Response(JSON.stringify({ ok: false, error: 'not used' }))
    return new Response(null, { status: 204 })
  }) as typeof fetch
  configureSlack({ webhookUrl: SLACK, botToken: undefined, maxRetries: 1, retryTimeout: 0 })
  configureDiscord({ webhookUrl: DISCORD, botToken: undefined, maxRetries: 1, retryTimeout: 0 })
  configureTeams({ webhookUrl: TEAMS, maxRetries: 1, retryTimeout: 0 })
})

afterEach(() => {
  globalThis.fetch = realFetch
  configureSlack({ webhookUrl: undefined, botToken: undefined })
  configureDiscord({ webhookUrl: undefined, botToken: undefined })
  configureTeams({ webhookUrl: undefined })
})

describe('notify() through the chat channel', () => {
  it('sends the CI notifier\'s recipient-less message through a webhook', async () => {
    const [result] = await notify({}, payload, ['chat'], { ignorePreferences: true })
    expect(result?.success).toBe(true)
    expect(hosts).toEqual(['hooks.slack.com'])
  })

  it('uses the chat driver config/notification.ts names', async () => {
    notification.chat = { default: 'discord' }
    expect((await notify({}, payload, ['chat'], { ignorePreferences: true }))[0]?.success).toBe(true)

    notification.chat = { default: 'msTeams' }
    expect((await notify({}, payload, ['chat'], { ignorePreferences: true }))[0]?.success).toBe(true)

    expect(hosts).toEqual(['discord.com', 'prod-27.westus.logic.azure.com'])
  })

  it('lets a recipient choose its own driver over config', async () => {
    notification.chat = { default: 'discord' }
    await notify({ chatDriver: 'teams' }, payload, ['chat'], { ignorePreferences: true })
    expect(hosts).toEqual(['prod-27.westus.logic.azure.com'])
  })

  it('still refuses a bot-token send with no channel, naming the field to set', async () => {
    configureSlack({ webhookUrl: undefined, botToken: 'xoxb-test' })
    const [result] = await notify({}, payload, ['chat'], { ignorePreferences: true })
    expect(result?.success).toBe(false)
    expect(result?.error?.message).toContain('recipient.chatRecipient')
    expect(hosts).toEqual([])
  })
})
