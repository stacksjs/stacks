import type { ExtensionConfig } from '../src/types'
import type { WebKitManifest } from '../src/webkit-build'
import { mkdtempSync } from 'node:fs'
import { mkdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import { buildExtension } from '../src/build'
import { chromeApisUsed, wrapForWebKit } from '../src/webkit-scripts'

describe('the webkit build target', () => {
  let cwd: string
  let outdir: string
  let manifest: WebKitManifest

  beforeAll(async () => {
    cwd = mkdtempSync(join(tmpdir(), 'browser-extension-webkit-'))
    await mkdir(join(cwd, 'src/content'), { recursive: true })
    await mkdir(join(cwd, 'src/rules'), { recursive: true })
    await Bun.write(join(cwd, 'src/rules/static.ts'), `export default function () {
  return [
    { id: 1, priority: 1, action: { type: 'block' }, condition: { urlFilter: '||ads.example^', resourceTypes: ['script', 'image'] } },
    { id: 2, priority: 2, action: { type: 'redirect', redirect: { extensionPath: '/stub.js' } }, condition: { urlFilter: '||cdn.example/gpt.js', resourceTypes: ['script'] } },
    { id: 3, priority: 3, action: { type: 'allow' }, condition: { urlFilter: '||news.example^', resourceTypes: ['main_frame'] } },
  ]
}
`)
    await Bun.write(join(cwd, 'src/rules/dynamic.ts'), `export const buildRules = () => [
  { id: 100, priority: 20, action: { type: 'block' }, condition: { requestDomains: ['blocked.example'], resourceTypes: ['main_frame', 'sub_frame'] } },
]
`)
    await Bun.write(join(cwd, 'src/rules/cosmetic.ts'), `export default [{ selector: ['.ad', '#sponsored'] }, { selector: '.yt-ad', domains: ['youtube.com'] }]
export const consent = () => [{ selector: '#cookie-banner' }]
`)
    await Bun.write(join(cwd, 'src/content/index.ts'), `void (async () => {
const settings = await chrome.storage.local.get({ enabled: true, theme: 'dark' })
const reply = await chrome.runtime.sendMessage({ type: 'hello', enabled: settings.enabled })
chrome.storage.onChanged.addListener((changes: any, area: string) => { (globalThis as any).__changed = { changes, area } })
chrome.runtime.onMessage.addListener((message: any, _sender: any, sendResponse: (value: unknown) => void) => { sendResponse({ echo: message }); return true })
;(globalThis as any).__result = { settings, reply }
})()
`)
    await Bun.write(join(cwd, 'src/content/page.ts'), `(window as any).__pageWorld = true\n`)
    await Bun.write(join(cwd, 'src/content/tabs.ts'), `void chrome.tabs.query({})\n`)

    const config: ExtensionConfig = {
      name: 'Test Blocker',
      description: 'webkit target fixture',
      rules: [{ id: 'static_rules', source: 'src/rules/static.ts' }],
      content: [
        { entry: 'src/content/index.ts', out: 'content.js', matches: ['https://*/*'], runAt: 'document_start', allFrames: true },
        { entry: 'src/content/page.ts', matches: ['*://*.youtube.com/*'], world: 'MAIN' },
        { entry: 'src/content/tabs.ts', matches: ['<all_urls>'], excludeMatches: ['*://skip.example/*'] },
      ],
      webkit: {
        dynamicRules: [{ id: 'dynamic_rules', source: 'src/rules/dynamic.ts' }],
        cosmetic: [{ id: 'cosmetic', source: 'src/rules/cosmetic.ts' }, { id: 'consent', source: 'src/rules/cosmetic.ts#consent', enabled: false }],
      },
    }
    ;({ outdir } = await buildExtension(config, { cwd, target: 'webkit', version: '1.2.3', minify: false }))
    manifest = await Bun.file(join(outdir, 'manifest.json')).json()
  })

  afterAll(async () => {
    await rm(cwd, { recursive: true, force: true })
  })

  it('writes dist-webkit with a manifest describing every list and script', () => {
    expect(outdir).toBe(join(cwd, 'dist-webkit'))
    expect(manifest).toMatchObject({ format: 'stacks-webkit', formatVersion: 1, name: 'Test Blocker', version: '1.2.3', maxRulesPerList: 50_000, bridge: { messageHandler: 'test-blocker', version: 1 } })
    expect(manifest.lists.map(list => [list.id, list.kind, list.file])).toEqual([
      ['static_rules', 'network', 'lists/static_rules.json'],
      ['dynamic_rules', 'network', 'lists/dynamic_rules.json'],
      ['cosmetic', 'cosmetic', 'lists/cosmetic.json'],
      ['consent', 'cosmetic', 'lists/consent.json'],
    ])
    // A named export feeds its own group, off by default like the extension's opt-in.
    expect(manifest.lists.at(-1)).toMatchObject({ enabled: false, ruleCount: 1 })
  })

  it('writes each list as the JSON compileContentRuleList takes, versioned by content', async () => {
    for (const list of manifest.lists) {
      const rules = await Bun.file(join(outdir, list.file)).json()
      expect(rules).toHaveLength(list.ruleCount)
      expect(list.version).toMatch(/^[0-9a-f]{16}$/)
    }
    const dynamic = await Bun.file(join(outdir, 'lists/dynamic_rules.json')).json()
    // The static ruleset's allow is repeated so it still lifts blocks from other lists.
    expect(dynamic.some((rule: any) => rule.action.type === 'ignore-previous-rules')).toBe(true)
  })

  it('reports the rules it could not convert', () => {
    expect(manifest.report.unsupported).toEqual([{ reason: 'redirect actions (content blockers cannot redirect)', count: 1, examples: [2] }])
    expect(manifest.report.input).toBe(7)
  })

  it('describes the scripts the way WKUserScript needs them', () => {
    expect(manifest.scripts.map(({ id, runAt, world, allFrames, bridged, file }) => ({ id, runAt, world, allFrames, bridged, file }))).toEqual([
      { id: 'content', runAt: 'document-start', world: 'isolated', allFrames: true, bridged: true, file: 'scripts/content.js' },
      { id: 'page', runAt: 'document-end', world: 'page', allFrames: false, bridged: false, file: 'scripts/page.js' },
      { id: 'tabs', runAt: 'document-end', world: 'isolated', allFrames: false, bridged: true, file: 'scripts/tabs.js' },
    ])
    expect(manifest.scripts[2]).toMatchObject({ excludeMatches: ['*://skip.example/*'], apis: ['tabs.query'], unsupportedApis: ['tabs.query'] })
    expect(manifest.scripts[0]!.apis).toEqual(['runtime.onMessage', 'runtime.sendMessage', 'storage.local', 'storage.onChanged'])
  })

  it('runs a bridged script against window.webkit.messageHandlers, both directions', async () => {
    const posted: any[] = []
    const g = globalThis as any
    g.webkit = {
      messageHandlers: {
        'test-blocker': {
          postMessage: async (body: any) => {
            posted.push(body)
            if (body.api === 'storage.get')
              return { enabled: false }
            if (body.api === 'runtime.sendMessage')
              return { ok: true }
            return null
          },
        },
      },
    }
    try {
      // eslint-disable-next-line no-eval
      ;(0, eval)(await Bun.file(join(outdir, 'scripts/content.js')).text())
      for (let i = 0; i < 20 && !g.__result; i++)
        await Bun.sleep(5)

      expect(posted).toEqual([
        { v: 1, api: 'storage.get', payload: { area: 'local', keys: { enabled: true, theme: 'dark' } } },
        { v: 1, api: 'runtime.sendMessage', payload: { message: { type: 'hello', enabled: false } } },
      ])
      // Defaults the app did not return are filled in, as chrome.storage does.
      expect(g.__result).toEqual({ settings: { enabled: false, theme: 'dark' }, reply: { ok: true } })

      const bridge = g.__stacksWebKit['test-blocker']
      expect(await bridge.dispatch({ type: 'runtime.message', message: { ping: 1 } })).toEqual({ echo: { ping: 1 } })
      bridge.dispatch({ type: 'storage.changed', area: 'local', changes: { enabled: { oldValue: false, newValue: true } } })
      expect(g.__changed).toEqual({ area: 'local', changes: { enabled: { oldValue: false, newValue: true } } })
      // The page sees no `chrome` global.
      expect(g.chrome).toBeUndefined()
    }
    finally {
      delete g.webkit
      delete g.__stacksWebKit
      delete g.__result
      delete g.__changed
    }
  })

  it('rejects calls when the app installed no handler, and reports it through lastError for callbacks', async () => {
    const g = globalThis as any
    try {
      const wrapped = wrapForWebKit('globalThis.__api = chrome; chrome.runtime.id', { handler: 'missing', world: 'isolated' })
      // eslint-disable-next-line no-eval
      ;(0, eval)(wrapped.source)
      expect(wrapped.source).toStartWith('(function (chrome) {')
      await expect(g.__api.runtime.sendMessage({})).rejects.toThrow('no "missing" message handler')
      const lastError = await new Promise(resolve => g.__api.storage.sync.get('k', () => resolve(g.__api.runtime.lastError)))
      expect(lastError).toEqual({ message: expect.stringContaining('no "missing" message handler') })
      expect(g.__api.runtime.lastError).toBeUndefined()
    }
    finally {
      delete g.__api
      delete g.__stacksWebKit
    }
  })

  it('leaves page-world scripts and scripts without chrome.* unwrapped', () => {
    expect(wrapForWebKit('window.x = 1', { handler: 'h', world: 'isolated' })).toEqual({ source: 'window.x = 1', apis: [], unsupportedApis: [], bridged: false })
    expect(wrapForWebKit('chrome.runtime.id', { handler: 'h', world: 'page' }).bridged).toBe(false)
    expect(chromeApisUsed('a.chrome.runtime.x; chrome?.storage?.local.get(); browser.tabs.query()')).toEqual(['storage.local', 'tabs.query'])
  })
})
