import assert from 'node:assert/strict'
import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { mock } from 'bun:test'
import { registerPeerSource } from '@stacksjs/bun-router'

// The maintenance allow-list is matched against the client address as trusted
// proxies report it. It used to read the first X-Forwarded-For entry, which
// the client writes: naming one allowed address walked straight past the gate.

const ALLOWED = '192.0.2.10'
const root = await mkdtemp(join(tmpdir(), 'stacks-maintenance-client-address-'))
const paths = await import('@stacksjs/path')
mock.module('@stacksjs/path', () => ({ ...paths, storagePath: (...parts: string[]) => join(root, ...parts) }))
const maintenance = await import('../../src/maintenance')
process.env.APP_ENV = 'production'
process.env.APP_MAINTENANCE = 'false'
process.env.APP_COMING_SOON = 'false'

const server = Bun.serve({
  port: 0,
  hostname: '127.0.0.1',
  async fetch(req, srv) {
    registerPeerSource(srv)
    return (await maintenance.maintenanceGate(req)) ?? new Response('through')
  },
})

async function status(headers: Record<string, string> = {}): Promise<number> {
  return (await fetch(`http://127.0.0.1:${server.port}/work`, { headers })).status
}

try {
  await mkdir(join(root, 'framework'))
  await Bun.write(maintenance.maintenanceFilePath(), JSON.stringify({ time: 1, allowed: [ALLOWED] }))

  // The loopback peer is a trusted proxy, so the hop it reports counts...
  assert.equal(await status({ 'x-forwarded-for': ALLOWED }), 200)
  // ...and a client-written prefix in front of the real hop does not.
  assert.equal(await status({ 'x-forwarded-for': `${ALLOWED}, 198.51.100.1` }), 503)
  // Nor does a Cloudflare header that did not arrive from Cloudflare.
  assert.equal(await status({ 'x-forwarded-for': '198.51.100.1', 'cf-connecting-ip': ALLOWED }), 503)
  // A proxy that names nobody leaves its own loopback address, which
  // production does not trust.
  assert.equal(await status(), 503)
}
finally {
  server.stop(true)
  await rm(root, { recursive: true, force: true })
}
