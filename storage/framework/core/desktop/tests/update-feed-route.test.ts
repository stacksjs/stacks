import type { UpdateStore } from '../src/update-feed'
import { afterEach, describe, expect, test } from 'bun:test'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { answerUpdateArtifact, answerUpdateFeed, artifactUrlProblem, parseByteRange, publishDesktopUpdate, publishedArtifactUrl, serveUpdateArtifact, sliceStream, storageUpdateStore, updateArtifactKey, updateArtifactUrl } from '../src/update-feed'
import { generateUpdateKeypair } from '../src/update-signing'
import { checkForDesktopUpdate } from '../src/updater'

const scratch: string[] = []
function temporary(): string {
  const directory = mkdtempSync(join(tmpdir(), 'stacks-feed-'))
  scratch.push(directory)
  return directory
}
afterEach(() => {
  for (const directory of scratch.splice(0)) rmSync(directory, { recursive: true, force: true })
})

const keys = generateUpdateKeypair()

async function published(options: { channel?: string, prefix?: string } = {}): Promise<UpdateStore> {
  const files = new Map<string, string>()
  const store: UpdateStore = {
    read: async key => files.get(key) ?? null,
    write: async (key, contents) => { files.set(key, typeof contents === 'string' ? contents : '(binary)') },
    publicUrl: async key => `https://cdn.example.com/${key}`,
  }
  const artifact = join(temporary(), 'Fettler-0.4.0-arm64.zip')
  writeFileSync(artifact, 'the app')
  await publishDesktopUpdate({ store, artifact, version: '0.4.0', sourceRevision: 'a'.repeat(40), privateKey: keys.privateKey, platform: 'darwin', architecture: 'arm64', ...options })
  return store
}

describe('GET /api/updates/{platform}/{arch}', () => {
  test('through the router: the path names the platform, the query the channel and running version', async () => {
    const { Router } = await import('@stacksjs/router')
    const router = new Router()
    const store = await published()
    router.get('/api/updates/{platform}/{arch}', (request: Request & { params?: Record<string, string> }) => {
      const url = new URL(request.url)
      return answerUpdateFeed({ store, platform: request.params?.platform ?? '', architecture: request.params?.arch ?? '', channel: url.searchParams.get('channel'), currentVersion: url.searchParams.get('current') })
    })

    const fresh = await router.handleRequest(new Request('http://localhost/api/updates/darwin/arm64?current=0.3.0'))
    expect(fresh.status).toBe(200)
    // What the router hands back is something a real app accepts.
    const manifest = await checkForDesktopUpdate({ currentVersion: '0.3.0', manifestUrl: 'https://x.example/api/updates/darwin/arm64', trustedKeys: { main: keys.publicKey }, target: { platform: 'darwin', architecture: 'arm64' }, fetcher: async () => fresh })
    expect(manifest?.version).toBe('0.4.0')

    expect((await router.handleRequest(new Request('http://localhost/api/updates/darwin/arm64?current=0.4.0'))).status).toBe(204)
    expect((await router.handleRequest(new Request('http://localhost/api/updates/darwin/x64'))).status).toBe(404)
    expect((await router.handleRequest(new Request('http://localhost/api/updates/darwin/arm64?channel=beta'))).status).toBe(404)
    expect((await router.handleRequest(new Request('http://localhost/api/updates/darwin'))).status).toBe(404)
  })

  test('the channel and folder come from webview.updates unless the request names a channel', async () => {
    const store = await published({ channel: 'beta', prefix: 'fettler/updates' })
    const updates = { channel: 'beta', prefix: 'fettler/updates' }
    expect((await answerUpdateFeed({ store, updates, platform: 'darwin', architecture: 'arm64' })).status).toBe(200)
    expect((await answerUpdateFeed({ store, updates, platform: 'darwin', architecture: 'arm64', channel: 'stable' })).status).toBe(404)
    expect((await answerUpdateFeed({ store, platform: 'darwin', architecture: 'arm64' })).status).toBe(404)
  })

  test('a project that publishes no desktop updates answers 404, with or without a config', async () => {
    const root = temporary()
    const none = await answerUpdateFeed({ root, platform: 'darwin', architecture: 'arm64' })
    expect(none.status).toBe(404)
    expect(await none.json()).toEqual({ error: 'This app publishes no desktop updates.' })
    mkdirSync(join(root, 'config'))
    writeFileSync(join(root, 'config/desktop.ts'), 'export default { webview: { appName: "A", appId: "org.a.app" } }\n')
    expect((await answerUpdateFeed({ root, platform: 'darwin', architecture: 'arm64' })).status).toBe(404)
  })

  test('the default action reads the platform and architecture from the path, the channel and version from the query', async () => {
    const action = (await import('../../../defaults/app/Actions/Desktop/UpdateFeedAction')).default as unknown as { handle: (request: unknown) => Promise<Response> }
    const asked: string[] = []
    const request = {
      getParam: (name: string) => { asked.push(`param:${name}`); return name === 'platform' ? 'darwin' : 'arm64' },
      get: (name: string) => { asked.push(`query:${name}`); return name === 'current' ? '0.3.0' : undefined },
    }
    // This repository builds no web view desktop app, so its own feed has nothing to serve.
    const response = await action.handle(request)
    expect(response.status).toBe(404)
    expect(await response.json()).toEqual({ error: 'This app publishes no desktop updates.' })
    expect(asked.sort()).toEqual(['param:arch', 'param:platform', 'query:channel', 'query:current'])
    const routes = readFileSync(join(import.meta.dir, '../../../defaults/routes/desktop-updates.ts'), 'utf8')
    expect(routes).toContain('route.get(\'/api/updates/{platform}/{arch}\', \'Actions/Desktop/UpdateFeedAction\')')
  })
})

/** A store over real bytes, served in small chunks so a range crosses chunk boundaries. */
function byteStore(files: Record<string, Uint8Array>, opened: string[] = []): UpdateStore {
  return {
    read: async () => null,
    write: async () => {},
    publicUrl: async key => `https://cdn.example.com/${key}`,
    open: async (key) => {
      opened.push(key)
      const bytes = files[key]
      if (!bytes) return null
      return {
        size: bytes.byteLength,
        stream: async (range) => {
          let at = 0
          const whole = new ReadableStream<Uint8Array>({
            pull(controller) {
              if (at >= bytes.byteLength) return controller.close()
              controller.enqueue(bytes.subarray(at, at += 7))
            },
          })
          return range ? sliceStream(whole, range.start, range.end) : whole
        },
      }
    },
  }
}

const zip = Uint8Array.from({ length: 100 }, (_, index) => index)
const zipKey = 'desktop-updates/stable/darwin-arm64/0.4.0/Fettler-0.4.0-arm64.zip'
const asked = { channel: 'stable', target: 'darwin-arm64', version: '0.4.0', file: 'Fettler-0.4.0-arm64.zip' }

describe('GET /api/updates/files/{channel}/{target}/{version}/{file}', () => {
  test('the URL a release writes is the one the route answers, through the router', async () => {
    const { Router } = await import('@stacksjs/router')
    const router = new Router()
    const store = byteStore({ [zipKey]: zip })
    router.get('/api/updates/files/{channel}/{target}/{version}/{file}', (request: Request & { params?: Record<string, string> }) => {
      const at = request.params ?? {}
      return answerUpdateArtifact({ store, channel: at.channel ?? '', target: at.target ?? '', version: at.version ?? '', file: at.file ?? '', range: request.headers.get('range'), method: request.method })
    })
    const url = await publishedArtifactUrl({ store, feedUrl: 'https://fettler.org/api/updates/', platform: 'darwin', architecture: 'arm64' }, '0.4.0', 'Fettler-0.4.0-arm64.zip')
    expect(url).toBe('https://fettler.org/api/updates/files/stable/darwin-arm64/0.4.0/Fettler-0.4.0-arm64.zip')

    const response = await router.handleRequest(new Request(url))
    expect(response.status).toBe(200)
    expect(response.headers.get('content-length')).toBe('100')
    expect(response.headers.get('content-type')).toBe('application/zip')
    expect(response.headers.get('content-disposition')).toBe('attachment; filename="Fettler-0.4.0-arm64.zip"')
    expect(response.headers.get('accept-ranges')).toBe('bytes')
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(zip)

    const part = await router.handleRequest(new Request(url, { headers: { range: 'bytes=10-29' } }))
    expect(part.status).toBe(206)
    expect(part.headers.get('content-range')).toBe('bytes 10-29/100')
    expect(part.headers.get('content-length')).toBe('20')
    expect(new Uint8Array(await part.arrayBuffer())).toEqual(zip.subarray(10, 30))

    // The feed beside it still answers: the two paths do not shadow each other.
    expect((await router.handleRequest(new Request('https://fettler.org/api/updates/files/stable/darwin-arm64/0.4.0/missing.zip'))).status).toBe(404)
  })

  test('a manifest published without a bucket URL names the route, and one with a bucket URL names the bucket', async () => {
    const files = new Map<string, string>()
    const store: UpdateStore = { read: async key => files.get(key) ?? null, write: async (key, contents) => { files.set(key, String(contents)) }, publicUrl: async key => `https://fettler.localhost/${key}` }
    const artifact = join(temporary(), 'Fettler-0.4.0-arm64.zip')
    writeFileSync(artifact, 'the app')
    const common = { store, artifact, version: '0.4.0', sourceRevision: 'a'.repeat(40), privateKey: keys.privateKey, platform: 'darwin', architecture: 'arm64', feedUrl: 'https://fettler.org/api/updates' }
    expect((await publishDesktopUpdate(common)).url).toBe('https://fettler.org/api/updates/files/stable/darwin-arm64/0.4.0/Fettler-0.4.0-arm64.zip')
    expect((await publishDesktopUpdate({ ...common, channel: 'beta', prefix: 'fettler/updates' })).url).toBe('https://fettler.org/api/updates/files/beta/darwin-arm64/0.4.0/Fettler-0.4.0-arm64.zip')
    expect((await publishDesktopUpdate({ ...common, artifactBaseUrl: 'https://cdn.fettler.org/' })).url).toBe('https://cdn.fettler.org/desktop-updates/stable/darwin-arm64/0.4.0/Fettler-0.4.0-arm64.zip')
    expect(updateArtifactUrl('https://fettler.org/api/updates', { platform: 'linux', architecture: 'x64' }, '0.4.0', 'Fettler 0.4.0.AppImage')).toBe('https://fettler.org/api/updates/files/stable/linux-x64/0.4.0/Fettler%200.4.0.AppImage')
  })

  test('only a key of the artifact shape under the configured folder is ever opened', async () => {
    const opened: string[] = []
    const store = byteStore({ [zipKey]: zip, 'desktop-updates/stable/secret.txt': zip, 'fettler/stable/darwin-arm64/0.4.0/a.zip': zip }, opened)
    const refusedShapes = [
      { ...asked, version: '..', file: 'secret.txt' },
      { ...asked, version: '.' },
      { ...asked, file: '..' },
      { ...asked, file: '../../secret.txt' },
      { ...asked, file: 'a/b.zip' },
      { ...asked, file: '.env' },
      { ...asked, channel: '..' },
      { ...asked, channel: 'stable/x' },
      { ...asked, target: 'darwin' },
      { ...asked, target: 'plan9-arm64' },
      { ...asked, target: 'darwin-arm64/..' },
      { ...asked, version: '' },
    ]
    for (const shape of refusedShapes) expect((await serveUpdateArtifact({ store, ...shape })).status).toBe(404)
    expect(opened).toEqual([])
    expect(() => updateArtifactKey({ platform: 'darwin', architecture: 'arm64' }, '..', 'a.zip')).toThrow('Invalid artifact name')

    // Another folder on the same disk is out of reach: the folder comes from the config, never the request.
    expect((await serveUpdateArtifact({ store, prefix: 'fettler', ...asked, file: 'a.zip' })).status).toBe(200)
    expect((await serveUpdateArtifact({ store, ...asked, file: 'a.zip' })).status).toBe(404)
    expect(opened).toEqual(['fettler/stable/darwin-arm64/0.4.0/a.zip', 'desktop-updates/stable/darwin-arm64/0.4.0/a.zip'])
  })

  test('ranges: a tail, an open end, past the end, and what is not a single range', async () => {
    const store = byteStore({ [zipKey]: zip })
    const get = (range: string): Promise<Response> => serveUpdateArtifact({ store, ...asked, range })
    const tail = await get('bytes=-5')
    expect(tail.headers.get('content-range')).toBe('bytes 95-99/100')
    expect(new Uint8Array(await tail.arrayBuffer())).toEqual(zip.subarray(95))
    const rest = await get('bytes=93-')
    expect(new Uint8Array(await rest.arrayBuffer())).toEqual(zip.subarray(93))
    expect((await get('bytes=90-500')).headers.get('content-range')).toBe('bytes 90-99/100')
    const beyond = await get('bytes=100-')
    expect(beyond.status).toBe(416)
    expect(beyond.headers.get('content-range')).toBe('bytes */100')
    expect((await get('bytes=0-1,5-6')).status).toBe(200)
    expect((await get('lines=1-2')).status).toBe(200)
    expect(parseByteRange('bytes=5-2', 100)).toBe(false)
    expect(parseByteRange('bytes=-0', 100)).toBe(false)
    expect(parseByteRange(null, 100)).toBeNull()

    const head = await serveUpdateArtifact({ store, ...asked, method: 'HEAD' })
    expect(head.headers.get('content-length')).toBe('100')
    expect(head.body).toBeNull()
  })

  test('from a real local disk: streamed, never through a public URL', async () => {
    const root = temporary()
    const { Storage } = await import('@stacksjs/storage')
    Storage.init({ default: 'updates-test', disks: { 'updates-test': { driver: 'local', root, visibility: 'private' } } } as Parameters<typeof Storage.init>[0])
    try {
      const store = await storageUpdateStore('updates-test')
      const artifact = join(temporary(), 'Fettler-0.4.0-arm64.zip')
      const bytes = Uint8Array.from({ length: 300_000 }, (_, index) => index % 251)
      writeFileSync(artifact, bytes)
      const manifest = await publishDesktopUpdate({ store, artifact, version: '0.4.0', sourceRevision: 'a'.repeat(40), privateKey: keys.privateKey, platform: 'darwin', architecture: 'arm64', feedUrl: 'https://fettler.org/api/updates' })
      const [channel, target, version, file] = new URL(manifest.url).pathname.replace('/api/updates/files/', '').split('/') as [string, string, string, string]

      const whole = await serveUpdateArtifact({ store, channel, target, version, file })
      expect(whole.headers.get('content-length')).toBe(String(manifest.size))
      expect(new Bun.CryptoHasher('sha256').update(await whole.arrayBuffer()).digest('hex')).toBe(manifest.sha256)

      const part = await serveUpdateArtifact({ store, channel, target, version, file, range: 'bytes=199990-200009' })
      expect(part.status).toBe(206)
      expect(new Uint8Array(await part.arrayBuffer())).toEqual(bytes.subarray(199_990, 200_010))
      expect((await serveUpdateArtifact({ store, channel, target, version: '0.5.0', file })).status).toBe(404)
    }
    finally {
      Storage.init({})
    }
  })

  test('a URL on this machine is not one a release may publish', () => {
    for (const url of ['https://fettler.localhost/desktop-updates/a.zip', 'http://localhost:3000/api/updates/files/a.zip', 'http://127.0.0.1/a.zip', 'http://[::1]:3000/a.zip', 'https://fettler.test/a.zip', 'ftp://fettler.org/a.zip', 'not a url']) expect(artifactUrlProblem(url)).toBeString()
    expect(artifactUrlProblem('https://fettler.org/api/updates/files/stable/darwin-arm64/0.4.0/a.zip')).toBeNull()
    expect(artifactUrlProblem('https://localhost.example.com/a.zip')).toBeNull()
  })

  test('the default action reads the four path parts, the Range header and the method, and is mounted beside the feed', async () => {
    const action = (await import('../../../defaults/app/Actions/Desktop/UpdateArtifactAction')).default as unknown as { handle: (request: unknown) => Promise<Response> }
    const read: string[] = []
    const response = await action.handle({
      getParam: (name: string) => { read.push(name); return asked[name as keyof typeof asked] },
      headers: new Headers({ range: 'bytes=0-1' }),
      method: 'GET',
    })
    // This repository builds no web view desktop app, so it has no artifacts to serve.
    expect(response.status).toBe(404)
    expect(read.sort()).toEqual(['channel', 'file', 'target', 'version'])
    const routes = readFileSync(join(import.meta.dir, '../../../defaults/routes/desktop-updates.ts'), 'utf8')
    expect(routes).toContain('route.get(\'/api/updates/files/{channel}/{target}/{version}/{file}\', \'Actions/Desktop/UpdateArtifactAction\')')
  })
})
