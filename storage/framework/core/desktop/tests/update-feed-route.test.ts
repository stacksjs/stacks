import type { UpdateStore } from '../src/update-feed'
import { afterEach, describe, expect, test } from 'bun:test'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { answerUpdateFeed, publishDesktopUpdate } from '../src/update-feed'
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
