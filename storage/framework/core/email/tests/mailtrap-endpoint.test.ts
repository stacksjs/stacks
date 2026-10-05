import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { config } from '@stacksjs/config'
import { MAILTRAP_SANDBOX_URL, MAILTRAP_SENDING_URL, MailtrapDriver, mailtrapEndpoint } from '../src/drivers/mailtrap'

/**
 * Mailtrap has two APIs, and the driver only reached one of them.
 *
 * It defaulted to the sandbox and required an inbox id, so an app configured
 * for production delivery could not send through Mailtrap at all. And the
 * default never applied anyway: `config/services.ts` writes `''` for an unset
 * `MAILTRAP_HOST`, `??` keeps it, and the request went to `/<inbox id>`
 * (stacksjs/stacks#2859).
 */
describe('mailtrapEndpoint', () => {
  test('delivers through the Sending API when no inbox is given', () => {
    expect(mailtrapEndpoint({})).toBe(MAILTRAP_SENDING_URL)
    expect(mailtrapEndpoint({ host: '', inboxId: '' })).toBe('https://send.api.mailtrap.io/api/send')
  })

  test('captures into the sandbox inbox when one is given', () => {
    expect(mailtrapEndpoint({ host: '', inboxId: '123456' })).toBe(`${MAILTRAP_SANDBOX_URL}/123456`)
    expect(mailtrapEndpoint({ inboxId: 42 })).toBe('https://sandbox.api.mailtrap.io/api/send/42')
  })

  test('honours a configured host either way, without doubling its slash', () => {
    expect(mailtrapEndpoint({ host: 'https://bulk.api.mailtrap.io/api/send' })).toBe('https://bulk.api.mailtrap.io/api/send')
    expect(mailtrapEndpoint({ host: 'https://sandbox.api.mailtrap.io/api/send/', inboxId: '7' })).toBe('https://sandbox.api.mailtrap.io/api/send/7')
  })

  test('refuses the sandbox host without an inbox, rather than posting to it', () => {
    expect(() => mailtrapEndpoint({ host: MAILTRAP_SANDBOX_URL })).toThrow('MAILTRAP_INBOX_ID')
  })
})

describe('MailtrapDriver.send', () => {
  const realFetch = globalThis.fetch
  let saved: unknown
  let requests: Array<{ url: string, authorization?: string }>
  let status = 200

  beforeEach(() => {
    saved = config.services
    requests = []
    status = 200
    globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
      requests.push({ url: String(input), authorization: (init?.headers as Record<string, string>)?.Authorization })
      return status === 200
        ? Response.json({ success: true, message_ids: ['m-1'] })
        : Response.json({ errors: ['Unauthorized'] }, { status })
    }) as typeof fetch
  })

  afterEach(() => {
    globalThis.fetch = realFetch
    ;(config as any).services = saved
  })

  function configure(mailtrap: Record<string, unknown>): void {
    ;(config as any).services = { ...(saved as object), mailtrap: { maxRetries: 3, retryTimeout: 0, ...mailtrap } }
  }

  const message = { from: { address: 'app@example.com' }, to: 'person@example.com', subject: 'Hi', html: '<p>Hi</p>' }

  test('delivers with the blank host and inbox config/services.ts produces when nothing is set', async () => {
    configure({ host: '', inboxId: '', token: 'live-token' })

    const result = await new MailtrapDriver().send(message as any)

    expect(result.success).toBe(true)
    expect(requests).toEqual([{ url: MAILTRAP_SENDING_URL, authorization: 'Bearer live-token' }])
  })

  test('captures into the sandbox inbox when one is configured', async () => {
    configure({ host: '', inboxId: '99', token: 'test-token' })

    await new MailtrapDriver().send(message as any)

    expect(requests.map(request => request.url)).toEqual([`${MAILTRAP_SANDBOX_URL}/99`])
  })

  test('does not retry a rejected token', async () => {
    configure({ host: '', inboxId: '', token: 'revoked' })
    status = 401

    const result = await new MailtrapDriver().send(message as any)

    expect(result.success).toBe(false)
    expect(requests).toHaveLength(1)
  })

  test('still retries a rate limit', async () => {
    configure({ host: '', inboxId: '', token: 'live-token' })
    status = 429

    await new MailtrapDriver().send(message as any)

    expect(requests).toHaveLength(3)
  })

  test('says which variable is missing when there is no token', async () => {
    configure({ host: '', inboxId: '', token: '' })

    const result = await new MailtrapDriver().send(message as any)

    expect(result.success).toBe(false)
    expect(result.message).toContain('MAILTRAP_TOKEN')
    expect(requests).toEqual([])
  })
})
