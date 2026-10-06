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

    // A disk's own signed URL names the disk, and is read from it whatever
    // the default is. It used to be read from the default disk, so a URL
    // signed on 'second' served 'first''s file at the same path.
    await Storage.disk('first').write(file, 'first file')
    Storage.setDefaultDisk('first')
    const secondUrl = new URL(await Storage.disk('second').signedUrl(file, { expiresIn: 3600, baseUrl: 'http://127.0.0.1' }))
    await request(file, secondUrl.searchParams.get('token')!, 200, 'second disk')
    const firstUrl = new URL(await Storage.disk('first').signedUrl(file, { expiresIn: 3600, baseUrl: 'http://127.0.0.1' }))
    Storage.setDefaultDisk('second')
    await request(file, firstUrl.searchParams.get('token')!, 200, 'first file')
    // A file that can run script is downloaded and sandboxed, never rendered
    // inline on the app's origin; an image is still served inline.
    for (const [name, body, active] of [['avatar.svg', '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>', true], ['page.html', '<script>alert(1)</script>', true], ['photo.png', 'png', false]] as const) {
      const path = `uploads/${nativeRoutes}-${name}`
      await Storage.disk('first').write(path, body)
      const response = await fetch(`http://127.0.0.1:${server.port}/__storage/${encodeURIComponent(path)}?token=${encodeURIComponent(createSignedStorageToken(path, { expiresIn: 3600, disk: 'first' }))}`)
      assert.equal(response.status, 200, path)
      assert.equal(response.headers.get('x-content-type-options'), 'nosniff')
      if (active) {
        assert.match(response.headers.get('content-disposition') ?? '', /^attachment; filename="/, path)
        assert.equal(response.headers.get('content-security-policy'), 'sandbox', path)
      }
      else {
        assert.equal(response.headers.get('content-disposition'), null, path)
        assert.equal(response.headers.get('content-security-policy'), null, path)
      }
    }

    // A token naming a disk that is not configured is a 404, not a read from
    // some other disk.
    await request(file, createSignedStorageToken(file, { expiresIn: 3600, disk: 'gone' }), 404, 'Not Found')
    console.log(`PASS signed storage: live access, files and disk, signing disk, nativeRoutes=${nativeRoutes}`)
  }
  finally {
    process.env.APP_KEY = originalKey
    await server.stop(true)
  }
}
Storage.reset()
