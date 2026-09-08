import assert from 'node:assert/strict'
import { join } from 'node:path'
import { overridesReady } from '@stacksjs/config'
import { createStacksRouter } from '@stacksjs/router'
import { createSignedStorageToken, revokeSignedStorageToken, Storage } from '@stacksjs/storage'

await overridesReady
const directory = process.argv[2]!
const originalKey = process.env.APP_KEY!
Storage.init({
  default: 'first',
  disks: {
    first: { driver: 'local', root: join(directory, 'first') },
    second: { driver: 'local', root: join(directory, 'second') },
  },
})
for (const nativeRoutes of [false, true]) {
  Storage.setDefaultDisk('first')
  const file = `reports/quarter ${nativeRoutes}.txt`
  const other = `other-${nativeRoutes}.txt`
  await Storage.disk('first').write(file, 'first file')
  await Storage.disk('second').write(file, 'second disk')
  await Storage.disk('first').write(other, 'private other file')
  const token = createSignedStorageToken(file, { expiresIn: 3600 })
  const router = createStacksRouter({ autoDiscoverRoutes: false })
  router.health()
  const server = await router.serve({ port: 0, hostname: '127.0.0.1', nativeRoutes })
  try {
    const request = async (path: string, value: string | undefined, status: number, body: string) => {
      const query = value === undefined ? '' : `?token=${encodeURIComponent(value)}`
      const response = await fetch(`http://127.0.0.1:${server.port}/__storage/${encodeURIComponent(path)}${query}`, {
        headers: { accept: 'application/json' },
      })
      assert.equal(response.status, status, `path=${path}, nativeRoutes=${nativeRoutes}`)
      assert.equal(await response.text(), body)
      if (status === 200) {
        assert.equal(response.headers.get('x-content-type-options'), 'nosniff')
        assert.equal(response.headers.get('cache-control'), 'private, max-age=60')
        assert.match(response.headers.get('content-type')!, /^text\/plain/)
      }
    }
    await request(file, token, 200, 'first file')
    for (const name of ['100% done.txt', 'a%2Fb.txt']) {
      const literal = `reports/${nativeRoutes}-${name}`
      await Storage.disk('first').write(literal, name)
      const literalToken = createSignedStorageToken(literal, { expiresIn: 3600 })
      await request(literal, literalToken, 200, name)
    }
    await Promise.all([
      request(file, undefined, 403, 'Forbidden'),
      request(file, 'malformed', 403, 'Forbidden'),
      request(other, token, 403, 'Forbidden'),
      request(file, createSignedStorageToken(file, { expiresIn: new Date(0) }), 403, 'Forbidden'),
    ])
    await Storage.disk('first').write(file, 'updated file')
    await request(file, token, 200, 'updated file')
    await Storage.disk('first').deleteFile(file)
    await request(file, token, 404, 'Not Found')
    Storage.setDefaultDisk('second')
    await request(file, token, 200, 'second disk')
    process.env.APP_KEY = 'rotated-signed-storage-test-key-at-least-32-characters'
    await request(file, token, 403, 'Forbidden')
    process.env.APP_KEY = originalKey
    await request(file, token, 200, 'second disk')
    revokeSignedStorageToken(token)
    await request(file, token, 403, 'Forbidden')
    console.log(`PASS signed storage: live access, files and disk, nativeRoutes=${nativeRoutes}`)
  }
  finally {
    process.env.APP_KEY = originalKey
    await server.stop(true)
  }
}
Storage.reset()
