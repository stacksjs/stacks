import { expect, test } from 'bun:test'
import { runSupportVerification } from '../src/support-verification'

const nonce = 'a'.repeat(64)
const config = { supporthq: { url: 'https://hq.support', key: 'server-secret', project: 'project-1' } }
test('Buddy writes only public proof and confirms the matching deployed project without exposing the integration key', async () => {
  const output: string[] = []
  let saved: unknown
  let document: unknown
  const deps = {
    now: () => 1000, print: (value: string) => output.push(value),
    readState: async () => saved,
    writeState: async (value: unknown) => { saved = value },
    writeDocument: async (value: unknown) => { document = value },
    fetch: (async (input, init) => {
      expect(new Headers(init?.headers).get('Authorization')).toBe('Bearer server-secret')
      if (String(input).endsWith('/confirm')) return Response.json({ verified: true, plan: 'free' })
      return Response.json({ challenge: { id: '1', nonce, project: 'project-1', origin: 'https://customer.example', expiresAt: 601000 }, document: { service: 'supporthq', project: 'project-1', nonce, framework: 'stacks', frameworkVersion: '0.75.575' } }, { status: 201 })
    }) as typeof fetch,
  }
  expect(await runSupportVerification(config, 'https://customer.example', { frameworkVersion: '0.75.575' }, deps)).toBe(true)
  expect(document).toEqual({ service: 'supporthq', project: 'project-1', nonce, framework: 'stacks', frameworkVersion: '0.75.575' })
  expect(await runSupportVerification(config, 'https://customer.example', { confirm: true, frameworkVersion: '0.75.575' }, deps)).toBe(true)
  expect(JSON.stringify([document, saved, output])).not.toContain('server-secret')
})

test('a stale or foreign local proof cannot claim another workspace and unsafe URLs never send credentials', async () => {
  let calls = 0
  const deps = {
    now: () => 1000, print() {}, writeDocument: async () => {}, writeState: async () => {},
    readState: async () => ({ id: '1', nonce, project: 'different-project', origin: 'https://customer.example', expiresAt: 601000 }),
    fetch: (async () => { calls++; return Response.json({ verified: true, plan: 'free' }) }) as typeof fetch,
  }
  expect(await runSupportVerification(config, 'https://customer.example', { confirm: true, frameworkVersion: '0.75.575' }, deps)).toBe(false)
  expect(await runSupportVerification(config, 'https://user:password@customer.example', { frameworkVersion: '0.75.575' }, deps)).toBe(false)
  expect(calls).toBe(0)
})
