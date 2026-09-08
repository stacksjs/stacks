import assert from 'node:assert/strict'
import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { mock } from 'bun:test'
import { Middleware } from '../../../router/src/middleware'

const root = await mkdtemp(join(tmpdir(), 'stacks-maintenance-middleware-'))
const paths = await import('@stacksjs/path')
// Isolate the storage root and unrelated package barrels. The middleware,
// gate implementation, file IO and environment detection remain real.
mock.module('@stacksjs/path', () => ({ ...paths, storagePath: (...parts: string[]) => join(root, ...parts) }))
const maintenance = await import('../../src/maintenance')
mock.module('@stacksjs/server', () => maintenance)
mock.module('@stacksjs/router', () => ({ Middleware }))
const { default: middleware } = await import('../../../../defaults/app/Middleware/Maintenance')
process.env.APP_ENV = 'production'
process.env.APP_MAINTENANCE = 'false'
process.env.APP_COMING_SOON = 'false'

async function request(path = '/work', cookie?: string): Promise<Response | undefined> {
  try {
    await middleware.handle(new Request(`https://app.example${path}`, { headers: cookie ? { cookie } : undefined }))
    return undefined
  }
  catch (response) {
    assert(response instanceof Response)
    return response
  }
}

try {
  await mkdir(join(root, 'framework'))
  assert.deepEqual(await Promise.all(Array.from({ length: 8 }, () => request())), Array(8).fill(undefined))
  await Bun.write(maintenance.maintenanceFilePath(), JSON.stringify({ time: 1, secret: 'preview-secret', retry: 60 }))
  const blocked = await request()
  assert.equal(blocked?.status, 503)
  assert.equal(blocked?.headers.get('retry-after'), '60')
  const bypass = await request('/preview-secret')
  assert.equal(bypass?.status, 302)
  const cookie = bypass?.headers.get('set-cookie')?.split(';')[0]
  assert(cookie)
  assert.equal(await request('/work', cookie), undefined)

  await Bun.write(maintenance.comingSoonFilePath(), JSON.stringify({ time: 2 }))
  assert.equal((await request())?.status, 503, 'maintenance still takes precedence')
  await rm(maintenance.maintenanceFilePath())
  const comingSoon = await request()
  assert.equal(comingSoon?.status, 302)
  assert.equal(comingSoon?.headers.get('location'), '/coming-soon')
  await rm(maintenance.comingSoonFilePath())
  assert.equal(await request(), undefined)

  process.env.APP_MAINTENANCE = 'true'
  assert.equal((await request())?.status, 503)
  process.env.APP_MAINTENANCE = 'false'
  assert.equal(await request(), undefined)
}
finally {
  await rm(root, { recursive: true, force: true })
}
