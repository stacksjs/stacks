/**
 * Sends through the chat drivers with settings that exist only in the
 * environment config/services.ts reads, and records what reached the wire.
 * For config-credentials.test.ts.
 */
import process from 'node:process'

const requests: Array<{ url: string, headers: Record<string, string> }> = []
let failures = Number(process.env.FIXTURE_FAILURES ?? 0)

globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
  requests.push({ url: String(input instanceof Request ? input.url : input), headers: { ...(init?.headers as Record<string, string> ?? {}) } })
  if (failures-- > 0)
    return new Response('down', { status: 503 })
  if (String(input).includes('slack.com/api'))
    return Response.json({ ok: true, ts: '1.2' })
  return new Response(null, { status: 204 })
}) as typeof fetch

const { send } = await import('../../src')
const out: Record<string, unknown> = {}
for (const driver of ['slack', 'discord', 'teams'] as const)
  out[driver] = await send({ to: '#general', content: 'hello' } as any, { driver })

out.requests = requests
console.log(JSON.stringify(out))
process.exit(0)
