import { describe, expect, test } from 'bun:test'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { resolveMacosDesktop } from '@stacksjs/desktop-build'
import { craftSupportsWebkit, macosAgentDevManifest, macosAgentEntry } from '../src/build/macos-native'

/**
 * The build side of `macos.agent` and `macos.webkit`: which routes the agent
 * bundles, the manifest a development run starts from, and whether the Craft
 * in use can link WebKit at all.
 */

const browser = { appName: 'Browser', bundleId: 'com.stacksjs.browser', nativeScreens: ['Main'], agent: true } as const

describe('craftSupportsWebkit', () => {
  test('recognises the option in source and once minified', () => {
    expect(craftSupportsWebkit('if (options.webkit) args.push("-framework", "WebKit")')).toBe(true)
    expect(craftSupportsWebkit('e.webkit&&t.push("-framework","WebKit")')).toBe(true)
    expect(craftSupportsWebkit('const { outdir, webkit } = options')).toBe(true)
  })

  test('a host that only mentions WebKit in a comment does not count', () => {
    expect(craftSupportsWebkit('/** Compile Craft\'s AppKit host. No WebKit. */')).toBe(false)
  })

  /*
   * The real question: does the craft-native this framework resolves take the
   * option yet? Craft is adding it separately; until a release carries it, this
   * says so instead of passing on a host that would build without WebKit.
   */
  let source = ''
  try {
    const desktop = Bun.resolveSync('@stacksjs/desktop-build/package.json', import.meta.dir)
    source = readFileSync(Bun.resolveSync('craft-native/macos', dirname(desktop)), 'utf8')
  }
  catch {}
  const supported = source !== '' && craftSupportsWebkit(source)
  if (!supported)
    console.warn('[macos-native-agent.test] skipping: the installed craft-native buildMacOSNative does not accept `webkit` yet. Raise the craft-native floor in core/desktop/package.json once a release links WebKit.')
  test.skipIf(!supported)('the installed craft-native links WebKit when asked', () => {
    expect(craftSupportsWebkit(source)).toBe(true)
  })
})

describe('the agent entry', () => {
  test('app/Desktop/Agent.ts by convention, nothing when the project has none', () => {
    const root = mkdtempSync(join(tmpdir(), 'stacks-agent-entry-'))
    try {
      const config = resolveMacosDesktop(browser, '1.0.0')
      expect(macosAgentEntry(root, config)).toBeUndefined()
      mkdirSync(join(root, 'app/Desktop'), { recursive: true })
      writeFileSync(join(root, 'app/Desktop/Agent.ts'), '')
      expect(macosAgentEntry(root, config)).toBe(join(root, 'app/Desktop/Agent.ts'))
      expect(macosAgentEntry(root, resolveMacosDesktop({ ...browser, agent: false, url: 'https://x.example' }, '1.0.0'))).toBeUndefined()
    }
    finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  test('a configured entry that does not exist fails the build by name', () => {
    expect(() => macosAgentEntry('/nowhere', resolveMacosDesktop({ ...browser, agent: { entry: 'agent/routes.ts' } }, '1.0.0'))).toThrow('agent/routes.ts')
  })
})

describe('the development manifest', () => {
  test('loads the project routes from the project, with the host and screens just built', () => {
    const manifest = macosAgentDevManifest(resolveMacosDesktop({ ...browser, agent: { port: 4810, staticDir: 'storage/web' } }, '1.2.0'), { root: '/p', host: '/p/host', nativeBundle: '/p/screens.js' })
    expect(manifest).toMatchObject({ appName: 'Browser', version: '1.2.0', host: '/p/host', nativeBundle: '/p/screens.js', port: 4810, staticDir: '/p/storage/web', projectRoot: '/p', appRoutes: true })
    expect(manifest.hostArguments).not.toContain('--api-url')
  })

  test('appRoutes: false serves only the agent entry', () => {
    expect(macosAgentDevManifest(resolveMacosDesktop({ ...browser, agent: { appRoutes: false } }, '1.0.0'), { root: '/p', host: '/h', nativeBundle: '/s' }).appRoutes).toBe(false)
  })
})
