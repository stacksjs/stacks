import { describe, expect, it } from 'bun:test'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

/**
 * stacksjs/stacks#2857: `config/services.ts` declares the FCM service account
 * and the Expo access token, from `FCM_PROJECT_ID`, `FCM_CLIENT_EMAIL`,
 * `FCM_PRIVATE_KEY` and `EXPO_ACCESS_TOKEN`, and nothing read any of them. An
 * app that set exactly what the config file invites got "not configured" from
 * FCM and every push rejected by an Expo project with enhanced security.
 *
 * Each value is checked where it has an effect - in the URL, the signed
 * assertion, the request headers - rather than in the driver's state, because
 * "the driver holds it" is what the bug looked like from inside too.
 */

const CLIENT_EMAIL = 'push@acme-prod.iam.gserviceaccount.com'

async function serviceAccountKey(): Promise<{ pem: string, publicKey: CryptoKey }> {
  const pair = await crypto.subtle.generateKey(
    { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
    true,
    ['sign', 'verify'],
  ) as CryptoKeyPair
  const pkcs8 = btoa(String.fromCharCode(...new Uint8Array(await crypto.subtle.exportKey('pkcs8', pair.privateKey))))
  return {
    pem: `-----BEGIN PRIVATE KEY-----\n${pkcs8.replace(/(.{64})/g, '$1\n')}\n-----END PRIVATE KEY-----\n`,
    publicKey: pair.publicKey,
  }
}

function decode(segment: string): Uint8Array {
  const padded = segment.padEnd(segment.length + ((4 - (segment.length % 4)) % 4), '=')
  return Uint8Array.from(atob(padded.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0))
}

async function run(env: Record<string, string>, step = 'from-config'): Promise<Record<string, any>> {
  const root = await mkdtemp(join(tmpdir(), 'stacks-push-config-'))
  try {
    await writeFile(join(root, 'bunfig.toml'), '# no preload\n')
    const child = Bun.spawn([process.execPath, `--config=${join(root, 'bunfig.toml')}`, '--no-env-file', `${import.meta.dir}/fixtures/push-from-config.ts`], {
      cwd: join(import.meta.dir, '../../../../..'),
      env: { ...process.env, APP_ENV: 'test', FIXTURE_STEP: step, ...env },
      stdout: 'pipe',
      stderr: 'pipe',
    })
    const [code, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()])
    const line = stdout.trim().split('\n').reverse().find(candidate => candidate.startsWith('{'))
    if (code !== 0 || !line)
      throw new Error(`fixture exited ${code}\n${stdout}\n${stderr}`)
    return JSON.parse(line)
  }
  finally {
    await rm(root, { recursive: true, force: true })
  }
}

describe('push credentials from config/services.ts (stacksjs/stacks#2857)', () => {
  it('reads every key the config file declares, and only those', async () => {
    const out = await run({})

    // A key added to config/services.ts without a reader fails here, which is
    // the drift that let all four go unread.
    expect(out.fcmKeys).toEqual(['clientEmail', 'privateKey', 'projectId'])
    expect(out.expoKeys).toEqual(['accessToken'])
  }, 60_000)

  it('sends through FCM with nothing but the documented env vars', async () => {
    const { pem, publicKey } = await serviceAccountKey()
    // As a service account JSON pastes into .env: newlines as literal \n.
    const out = await run({
      FCM_PROJECT_ID: 'acme-prod',
      FCM_CLIENT_EMAIL: CLIENT_EMAIL,
      FCM_PRIVATE_KEY: pem.replace(/\n/g, '\\n'),
    })

    expect(out.fcm0.success).toBe(true)

    const exchanges = out.requests.filter((request: any) => request.url.startsWith('https://oauth2.googleapis.com/token'))
    // One exchange for three sends: the token is reused until it nears expiry.
    expect(exchanges).toHaveLength(1)

    const assertion = new URLSearchParams(exchanges[0].body).get('assertion')!
    const [header, payload, signature] = assertion.split('.')
    expect(JSON.parse(new TextDecoder().decode(decode(payload!))).iss).toBe(CLIENT_EMAIL)
    // Signed with the configured key, not merely accepted by the encoder.
    expect(await crypto.subtle.verify('RSASSA-PKCS1-v1_5', publicKey, decode(signature!), new TextEncoder().encode(`${header}.${payload}`))).toBe(true)

    const sends = out.requests.filter((request: any) => request.url.includes('fcm.googleapis.com'))
    expect(sends).toHaveLength(3)
    expect(sends[0].url).toBe('https://fcm.googleapis.com/v1/projects/acme-prod/messages:send')
    expect(sends[0].headers.Authorization).toBe('Bearer ya29.fixture')
  }, 60_000)

  it('sends the Expo access token when one is configured', async () => {
    const out = await run({ EXPO_ACCESS_TOKEN: 'expo-secret' })

    const expoRequest = out.requests.find((request: any) => request.url.includes('exp.host'))
    expect(expoRequest.headers.Authorization).toBe('Bearer expo-secret')
    expect(out.expo.success).toBe(true)
  }, 60_000)

  it('sends no Authorization header to Expo when none is configured', async () => {
    const out = await run({ EXPO_ACCESS_TOKEN: '' })

    const expoRequest = out.requests.find((request: any) => request.url.includes('exp.host'))
    expect(expoRequest.headers.Authorization).toBeUndefined()
  }, 60_000)

  it('still reports FCM as unconfigured when the env vars are empty', async () => {
    const out = await run({ FCM_PROJECT_ID: '', FCM_CLIENT_EMAIL: '', FCM_PRIVATE_KEY: '' })

    expect(out.fcm0.success).toBe(false)
    expect(out.fcm0.message).toContain('FCM_PROJECT_ID')
    expect(out.requests.filter((request: any) => request.url.includes('googleapis'))).toEqual([])
  }, 60_000)

  it('lets configure() win over config', async () => {
    const { pem } = await serviceAccountKey()
    const out = await run({
      FCM_PROJECT_ID: 'from-config',
      FCM_CLIENT_EMAIL: CLIENT_EMAIL,
      FCM_PRIVATE_KEY: pem,
      EXPO_ACCESS_TOKEN: 'from-config',
    }, 'configured-explicitly')

    const sends = out.requests.filter((request: any) => request.url.includes('fcm.googleapis.com'))
    expect(sends[0].url).toContain('/projects/explicit-project/')
    expect(out.requests.find((request: any) => request.url.includes('exp.host')).headers.Authorization).toBe('Bearer explicit-expo-token')
  }, 60_000)
})
