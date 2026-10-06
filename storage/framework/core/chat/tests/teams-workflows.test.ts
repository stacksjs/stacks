/**
 * The Teams driver posts to Teams Workflows webhooks.
 *
 * Microsoft retired the Office 365 connectors inside Teams in May 2026. The
 * driver accepted nothing but a connector URL (`url.includes('webhook.office.com')`),
 * so every URL that still delivers was refused as "not configured or
 * invalid", and the one it took no longer works. A plain message was sent as
 * a bare `{ text }` body, which the Workflows webhook template - reading the
 * card from `attachments` - cannot post.
 */

import { afterEach, describe, expect, test } from 'bun:test'
import { assertWebhookUrl, sendCard, sendWebhook, TeamsDriver } from '../src/drivers/teams'

const WORKFLOW = 'https://default0a1b2c.2d.environment.api.powerplatform.com:443/powerautomate/automations/direct/workflows/abc/triggers/manual/paths/invoke?api-version=1'
const LOGIC_APPS = 'https://prod-27.westus.logic.azure.com:443/workflows/abc/triggers/manual/paths/invoke?api-version=2016-06-01'

const realFetch = globalThis.fetch
let posted: Array<{ url: string, body: any }> = []

function captureFetch(status = 202): void {
  posted = []
  globalThis.fetch = (async (url: string, init?: RequestInit) => {
    posted.push({ url: String(url), body: JSON.parse(String(init?.body)) })
    return new Response(null, { status })
  }) as unknown as typeof fetch
}

afterEach(() => {
  globalThis.fetch = realFetch
})

describe('Teams webhook URLs', () => {
  test('Workflows hosts are accepted', () => {
    for (const url of [WORKFLOW, LOGIC_APPS, 'https://prod-01.usgovtexas.logic.azure.us/workflows/x', 'https://x.api.powerautomate.com/flows/y'])
      expect(() => assertWebhookUrl(url)).not.toThrow()
  })

  test('a retired connector URL is refused, saying what to use instead', () => {
    expect(() => assertWebhookUrl('https://acme.webhook.office.com/webhookb2/abc')).toThrow(/retired in May 2026.*Workflows/)
  })

  test('a URL that only mentions a Workflows host is refused', () => {
    expect(() => assertWebhookUrl('https://evil.example.com/?next=logic.azure.com')).toThrow('is not a Teams Workflows')
    expect(() => assertWebhookUrl('https://logic.azure.com.evil.example/x')).toThrow('is not a Teams Workflows')
    expect(() => assertWebhookUrl('http://prod-27.westus.logic.azure.com/x')).toThrow('https://')
  })

  test('configure() checks the URL as the config path does', () => {
    expect(() => new TeamsDriver({ webhookUrl: 'https://acme.webhook.office.com/webhookb2/abc' })).toThrow('retired')
  })
})

describe('what is posted', () => {
  test('a plain message is an Adaptive Card holding its text', async () => {
    captureFetch()
    const result = await new TeamsDriver({ webhookUrl: WORKFLOW, maxRetries: 1 }).send({ to: 'ops', content: 'Deploy finished' })

    expect(result.success).toBe(true)
    expect(posted).toHaveLength(1)
    expect(posted[0]!.url).toBe(WORKFLOW)
    const attachment = posted[0]!.body.attachments[0]
    expect(attachment.contentType).toBe('application/vnd.microsoft.card.adaptive')
    expect(attachment.content.body).toEqual([{ type: 'TextBlock', text: 'Deploy finished', wrap: true }])
  })

  test('a message with a subject keeps its title and timestamp', async () => {
    captureFetch()
    await new TeamsDriver({ webhookUrl: WORKFLOW, maxRetries: 1 }).send({ to: 'ops', subject: 'Deploy', content: 'Finished' })

    const blocks = posted[0]!.body.attachments[0].content.body
    expect(blocks[0]).toMatchObject({ text: 'Deploy', weight: 'Bolder' })
    expect(blocks[1]).toMatchObject({ text: 'Finished' })
    expect(blocks).toHaveLength(3)
  })

  test('sendWebhook() sends a card too, and refuses a connector URL without posting', async () => {
    captureFetch()
    expect((await sendWebhook(LOGIC_APPS, 'hello')).success).toBe(true)
    expect(posted[0]!.body.attachments[0].content.body[0].text).toBe('hello')

    const refused = await sendWebhook('https://acme.webhook.office.com/webhookb2/abc', 'hello')
    expect(refused.success).toBe(false)
    expect(posted).toHaveLength(1)
  })

  test('sendCard() posts the card it is given', async () => {
    captureFetch()
    const card = { type: 'AdaptiveCard' as const, version: '1.4', body: [{ type: 'TextBlock' as const, text: 'Hi' }] }
    expect((await sendCard(WORKFLOW, card, 'Greeting')).success).toBe(true)
    expect(posted[0]!.body).toEqual({ type: 'message', summary: 'Greeting', attachments: [{ contentType: 'application/vnd.microsoft.card.adaptive', content: card }] })
  })
})
