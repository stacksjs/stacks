import { describe, expect, it } from 'bun:test'
import { DiscordDriver, configure as configureDiscord } from '../src/drivers/discord'
import { SlackDriver, configure as configureSlack } from '../src/drivers/slack'
import { MetaMessagingClient } from '../src/meta'

function transport(handler: (url: string, init: RequestInit) => Response | Promise<Response>): typeof fetch {
  return ((input: RequestInfo | URL, init?: RequestInit) => Promise.resolve(handler(String(input), init ?? {}))) as typeof fetch
}

describe('scoped chat transport', () => {
  it('keeps Slack and Discord constructor credentials isolated from each other and the facade', async () => {
    for (const [Driver, configure, url, receipt] of [
      [SlackDriver, configureSlack, 'https://slack.com/api/chat.postMessage', { ok: true, ts: 'receipt' }],
      [DiscordDriver, configureDiscord, 'https://discord.com/api/v10/channels/123/messages', { id: 'receipt' }],
    ] as const) {
      const sent: string[] = []
      const fetcher = transport((actual, init) => {
        expect(actual).toBe(url)
        sent.push(new Headers(init.headers).get('authorization')!)
        return Response.json(receipt)
      })
      configure({ webhookUrl: undefined, botToken: 'global-app-token' })
      const tenantA = new Driver({ botToken: 'tenant-a' }, { fetch: fetcher })
      const tenantB = new Driver({ botToken: 'tenant-b' }, { fetch: fetcher })
      const global = new Driver(undefined, { fetch: fetcher })
      for (const instance of [tenantA, tenantB, tenantA, global]) {
        const result = await instance.send({ to: '123', content: 'hello' })
        expect(result.success).toBe(true)
        expect(result.messageId).toBe('receipt')
        expect(result.data?.outcome).toBe('accepted')
      }
      expect(sent.map(value => value.split(' ')[1])).toEqual(['tenant-a', 'tenant-b', 'tenant-a', 'global-app-token'])
      configure({ webhookUrl: undefined, botToken: undefined })
    }
  })

  it('does not repeat a send after a 503, lost acknowledgement or malformed success body', async () => {
    for (const response of [() => new Response(null, { status: 503 }), () => { throw new Error('socket lost') }, () => new Response('{')]) {
      for (const Driver of [SlackDriver, DiscordDriver]) {
        let calls = 0
        const driver = new Driver({ botToken: 'scoped', maxRetries: 3, retryTimeout: 0 }, { fetch: transport(() => { calls++; return response() }) })
        const result = await driver.send({ to: '123', content: 'hello' })
        expect(result.success).toBe(false)
        expect(result.data?.outcome).toBe('unknown')
        expect(calls).toBe(1)
      }
    }
  })

  it('retries only an explicit 429 rejection, then keeps the receipt', async () => {
    let calls = 0
    const driver = new SlackDriver({ botToken: 'scoped', maxRetries: 2, retryTimeout: 0 }, { fetch: transport(() => ++calls === 1
      ? new Response(null, { status: 429, headers: { 'retry-after': '0' } }) : Response.json({ ok: true, ts: 'after-rate-limit' })) })
    expect((await driver.send({ to: '123', content: 'hello' })).messageId).toBe('after-rate-limit')
    expect(calls).toBe(2)
  })

  it('retains provider acceptance and receipt when application callbacks fail', async () => {
    const driver = new SlackDriver({ botToken: 'scoped' }, { fetch: transport(() => Response.json({ ok: true, ts: 'accepted-before-callback' })) })
    const result = await driver.send({ to: '123', content: 'hi', onSuccess: () => { throw new Error('application callback failed') }, onError: () => { throw new Error('error callback failed') } })
    expect(result.success).toBe(false)
    expect(result.messageId).toBe('accepted-before-callback')
    expect(result.data?.outcome).toBe('accepted')
  })

  it('requests Discord webhook acknowledgement and rejects oversized text before transport', async () => {
    let calls = 0
    const driver = new DiscordDriver({ webhookUrl: 'https://discord.com/api/webhooks/123/secret' }, { fetch: transport((url) => {
      calls++
      expect(new URL(url).searchParams.get('wait')).toBe('true')
      return Response.json({ id: 'discord-receipt' })
    }) })
    expect((await driver.send({ content: 'hi' })).messageId).toBe('discord-receipt')
    const rejected = await driver.send({ content: 'x'.repeat(2001) })
    expect(rejected.data?.outcome).toBe('rejected')
    expect(calls).toBe(1)
  })
})

describe('native Meta text protocol', () => {
  it('sends Facebook and Instagram replies with scoped authorization and receipt IDs', async () => {
    for (const provider of ['messenger', 'instagram', 'instagram-facebook'] as const) {
      const client = new MetaMessagingClient({ provider, accountId: '456', apiVersion: 'v27.0', accessToken: `token-${provider}` }, { fetch: transport((url, init) => {
        const expectedHost = provider === 'instagram' ? 'graph.instagram.com' : 'graph.facebook.com'
        expect(new URL(url).hostname).toBe(expectedHost)
        expect(new Headers(init.headers).get('authorization')).toBe(`Bearer token-${provider}`)
        if (init.method !== 'POST')
          return Response.json({ id: '456', name: 'Support' })
        expect(new URL(url).pathname).toBe('/v27.0/456/messages')
        expect(JSON.parse(String(init.body))).toEqual({ recipient: { id: '789' }, message: { text: 'hello' }, ...(provider === 'messenger' ? { messaging_type: 'RESPONSE' } : {}) })
        return Response.json({ recipient_id: '789', message_id: 'meta-receipt' })
      }) })
      expect(await client.identity()).toEqual({ id: '456', name: 'Support' })
      expect(await client.sendText('789', 'hello')).toMatchObject({ outcome: 'accepted', messageId: 'meta-receipt' })
    }
  })

  it('preserves ambiguous outcomes and never invents a message receipt', async () => {
    for (const response of [() => new Response(null, { status: 503 }), () => Response.json({}), () => { throw new Error('timeout') }]) {
      let calls = 0
      const client = new MetaMessagingClient({ provider: 'messenger', accountId: '456', apiVersion: 'v27.0', accessToken: 'token' }, { fetch: transport(() => { calls++; return response() }) })
      expect((await client.sendText('789', 'hello')).outcome).toBe('unknown')
      expect(calls).toBe(1)
    }
  })
})
