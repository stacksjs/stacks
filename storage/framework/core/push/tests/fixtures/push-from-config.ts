/**
 * Sends through the push drivers with credentials that exist only in the
 * environment `config/services.ts` reads, and records what reached the wire.
 * For `config-credentials.test.ts` (stacksjs/stacks#2857).
 *
 * A subprocess because the config proxy loads the app's config once per
 * process, and the env vars have to be in place before it does.
 */
import process from 'node:process'

const requests: Array<{ url: string, headers: Record<string, string>, body: string }> = []

globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
  const url = String(input instanceof Request ? input.url : input)
  requests.push({ url, headers: { ...(init?.headers as Record<string, string> ?? {}) }, body: String(init?.body ?? '') })

  if (url.startsWith('https://oauth2.googleapis.com/token'))
    return Response.json({ access_token: 'ya29.fixture', expires_in: 3599 })
  if (url.includes('fcm.googleapis.com'))
    return Response.json({ name: 'projects/x/messages/1' })
  if (url.includes('exp.host'))
    return Response.json({ data: [{ status: 'ok', id: 'ticket-1' }] })
  return new Response('unexpected', { status: 500 })
}) as typeof fetch

const { config } = await import('@stacksjs/config')
const { expo, fcm, send } = await import('../../src')

const step = process.env.FIXTURE_STEP
const out: Record<string, unknown> = {}

// The keys config/services.ts declares, so the test can insist each is read.
out.fcmKeys = Object.keys((await import('@stacksjs/config').then(m => m.awaitConfig())).services?.fcm ?? {}).sort()
out.expoKeys = Object.keys(config.services?.expo ?? {}).sort()

if (step === 'configured-explicitly') {
  fcm.configure({ projectId: 'explicit-project' })
  expo.configure({ accessToken: 'explicit-expo-token' })
}

for (let i = 0; i < 3; i++)
  out[`fcm${i}`] = await send('device-token', { title: 'Hi', body: 'There' }, { driver: 'fcm' })
out.expo = await send('ExponentPushToken[abc]', { title: 'Hi', body: 'There' }, { driver: 'expo' })

out.requests = requests
console.log(JSON.stringify(out))
process.exit(0)
