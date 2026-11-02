import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { discord, slack, teams } from '../src'

/**
 * stacksjs/stacks#3101. `ChatMessage.content` is plain text and a webhook
 * already names where a message goes. Neither held: a webhook send with no
 * `to` was refused, Discord pinged @everyone for any content that said so
 * and sent the body twice, its camelCase options never reached Discord, and
 * Slack read the content as markup.
 *
 * Swapping globalThis.fetch rather than mock.module, which would leak into
 * every other test file in the process.
 */
const realFetch = globalThis.fetch
let sent: Array<{ url: string, body: any }> = []

const DISCORD = 'https://discord.com/api/webhooks/1/test'
const SLACK = 'https://hooks.slack.com/services/T0/B0/test'
const TEAMS = 'https://prod-27.westus.logic.azure.com:443/workflows/abc/triggers/manual/paths/invoke?api-version=2016-06-01'

beforeEach(() => {
  sent = []
  globalThis.fetch = (async (input: any, init: any = {}) => {
    sent.push({ url: String(input), body: init.body ? JSON.parse(init.body) : undefined })
    if (String(input).includes('slack.com/api/chat.postMessage'))
      return new Response(JSON.stringify({ ok: true, ts: '1' }))
    return new Response(null, { status: 204 })
  }) as typeof fetch
  discord.configure({ webhookUrl: DISCORD, botToken: undefined })
  slack.configure({ webhookUrl: SLACK, botToken: undefined })
  teams.configure({ webhookUrl: TEAMS })
})

afterEach(() => {
  globalThis.fetch = realFetch
  discord.configure({ webhookUrl: undefined, botToken: undefined })
  slack.configure({ webhookUrl: undefined, botToken: undefined })
  teams.configure({ webhookUrl: undefined })
})

describe('a webhook send', () => {
  it('needs no recipient, since the webhook says where it goes', async () => {
    for (const driver of [discord, slack, teams]) {
      const result = await driver.send({ content: 'Deploy finished' })
      expect(result.success).toBe(true)
    }
    expect(sent.map(s => new URL(s.url).host)).toEqual(['discord.com', 'hooks.slack.com', 'prod-27.westus.logic.azure.com'])
  })
})

describe('Discord', () => {
  it('never pings @everyone or @here unless told to', async () => {
    await discord.send({ content: 'Nice post @everyone' })
    expect(sent[0]?.body.allowed_mentions).toEqual({ parse: ['users', 'roles'] })
  })

  it('sends the body once: in the embed when there is a subject', async () => {
    await discord.send({ subject: 'New comment', content: 'Nice post' })
    expect(sent[0]?.body.content).toBeUndefined()
    expect(sent[0]?.body.embeds[0]).toMatchObject({ title: 'New comment', description: 'Nice post' })

    await discord.send({ content: 'Plain' })
    expect(sent[1]?.body.content).toBe('Plain')
    expect(sent[1]?.body.embeds).toBeUndefined()
  })

  it('sends sendWebhook options under the names Discord reads', async () => {
    await discord.sendWebhook(DISCORD, 'hi', { allowedMentions: { parse: [] }, avatarUrl: 'https://example.test/a.png', username: 'Bot' })
    expect(sent[0]?.body).toEqual({ content: 'hi', username: 'Bot', avatar_url: 'https://example.test/a.png', allowed_mentions: { parse: [] } })
  })

  it('asks a bot-token send for the channel it posts to', async () => {
    discord.configure({ webhookUrl: undefined, botToken: 'bot-token' })
    // configure() merges, so the webhook from beforeEach has to be cleared too.
    const result = await discord.send({ content: 'hi' })
    expect(result.success).toBe(false)
    expect(result.message).toContain('need message.to')
  })
})

describe('Slack', () => {
  it('sends content as the plain text it is', async () => {
    await slack.send({ content: 'Refund approved <!channel> see <https://evil.test|your invoice> & more' })
    expect(sent[0]?.body.text).toBe('Refund approved &lt;!channel&gt; see &lt;https://evil.test|your invoice&gt; &amp; more')
  })

  it('escapes the section a template adds too', async () => {
    await slack.send({ content: '<!here> hi', template: 'alert' })
    expect(sent[0]?.body.blocks.at(-1).text.text).toBe('&lt;!here&gt; hi')
  })

  it('asks a bot-token send for the channel it posts to', async () => {
    slack.configure({ webhookUrl: undefined, botToken: 'xoxb-test' })
    const missing = await slack.send({ content: 'hi' })
    expect(missing.success).toBe(false)
    expect(missing.message).toContain('need message.to')

    const posted = await slack.send({ to: '#ops', content: 'a < b' })
    expect(posted.success).toBe(true)
    expect(sent.at(-1)?.body).toMatchObject({ channel: '#ops', text: 'a &lt; b' })
  })
})
