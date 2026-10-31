import { describe, expect, test } from 'bun:test'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  agentHostArguments,
  defaultUsageDescriptions,
  hostArguments,
  renderHostConfig,
  renderMacosEntitlements,
  renderMacosHostEntitlements,
  renderMacosInfoPlist,
  resolveMacosDesktop,
  validateMacosDesktop,
} from '../src/index'

/**
 * `config/desktop.ts` keys for a local-first app (a browser): the agent,
 * `defaultBrowser`, `permissions`, `dockMenu` and `webkit`. Every plist is
 * also run through `plutil -lint` on macOS, since a malformed Info.plist is an
 * app that silently refuses to open.
 */

const browser = {
  appName: 'Browser',
  bundleId: 'com.stacksjs.browser',
  nativeScreens: ['Main'],
  agent: true,
} as const

function lint(xml: string): void {
  if (process.platform !== 'darwin') return
  const dir = mkdtempSync(join(tmpdir(), 'stacks-plist-'))
  try {
    writeFileSync(join(dir, 'x.plist'), xml)
    const result = Bun.spawnSync(['plutil', '-lint', join(dir, 'x.plist')], { stdout: 'pipe', stderr: 'pipe' })
    expect(result.stdout.toString() + result.stderr.toString()).toContain(': OK')
  }
  finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

/** The plist as JSON, by plutil itself rather than a regex. */
function parse(xml: string): Record<string, any> {
  const result = Bun.spawnSync(['plutil', '-convert', 'json', '-o', '-', '-'], { stdin: new TextEncoder().encode(xml), stdout: 'pipe', stderr: 'pipe' })
  if (result.exitCode !== 0) throw new Error(result.stderr.toString())
  return JSON.parse(result.stdout.toString())
}

const onMac = process.platform === 'darwin' ? test : test.skip

describe('macos.agent', () => {
  test('needs no url: the host is pointed at the agent', () => {
    const resolved = resolveMacosDesktop(browser, '1.0.0')
    expect(resolved.agent).toEqual({})
    expect(validateMacosDesktop(resolved)).toEqual([])
  })

  test('a hosted app without a url still fails, and says what to do', () => {
    const errors = validateMacosDesktop(resolveMacosDesktop({ ...browser, agent: false }, '1.0.0'))
    expect(errors.join('\n')).toContain('macos.agent')
  })

  test('rejects a privileged or out-of-range port', () => {
    expect(validateMacosDesktop(resolveMacosDesktop({ ...browser, agent: { port: 80 } }, '1.0.0')).join()).toContain('agent.port')
    expect(validateMacosDesktop(resolveMacosDesktop({ ...browser, agent: { port: 4810 } }, '1.0.0'))).toEqual([])
  })

  test('the packaged host asks for a session and carries no fixed origin', () => {
    const config = JSON.parse(renderHostConfig(resolveMacosDesktop(browser, '1.0.0')))
    expect(config.session).toBe(true)
    expect(config.apiUrl).toBeUndefined()
  })

  test('a hosted app keeps its origin and no session', () => {
    const config = JSON.parse(renderHostConfig(resolveMacosDesktop({ ...browser, agent: undefined, url: 'https://x.example/' }, '1.0.0')))
    expect(config).toMatchObject({ session: false, apiUrl: 'https://x.example' })
  })

  test('the host command line leaves the origin and the screens to the launcher', () => {
    const args = agentHostArguments(resolveMacosDesktop(browser, '1.0.0'))
    expect(args).not.toContain('--api-url')
    expect(args).not.toContain('--native-bundle')
    expect(args).not.toContain('--no-session')
    expect(args.slice(0, 4)).toEqual(['--title', 'Browser', '--route', 'Main'])
  })

  test('lets Bun JIT under the hardened runtime and listen on loopback in the sandbox', () => {
    const xml = renderMacosEntitlements(resolveMacosDesktop(browser, '1.0.0'), 'development')
    lint(xml)
    for (const key of ['com.apple.security.cs.allow-jit', 'com.apple.security.cs.allow-unsigned-executable-memory', 'com.apple.security.cs.disable-library-validation', 'com.apple.security.network.server'])
      expect(xml).toContain(`<key>${key}</key><true/>`)
    expect(renderMacosEntitlements(resolveMacosDesktop({ ...browser, sandbox: false }, '1.0.0'), 'development')).not.toContain('network.server')
  })

  test('the host it spawns inherits the sandbox and holds nothing else', () => {
    const xml = renderMacosHostEntitlements(resolveMacosDesktop({ ...browser, permissions: { camera: true } }, '1.0.0'))
    lint(xml)
    expect(xml).toContain('<key>com.apple.security.app-sandbox</key><true/>')
    expect(xml).toContain('<key>com.apple.security.inherit</key><true/>')
    expect(xml).not.toContain('camera')
  })

  test('unsandboxed, the host holds the device entitlements its web views need', () => {
    const xml = renderMacosHostEntitlements(resolveMacosDesktop({ ...browser, sandbox: false, permissions: { camera: true, microphone: 'Calls.' } }, '1.0.0'))
    expect(xml).toContain('com.apple.security.device.camera')
    expect(xml).toContain('com.apple.security.device.audio-input')
    expect(xml).not.toContain('inherit')
  })
})

describe('macos.defaultBrowser', () => {
  onMac('declares http and https, and the documents a browser opens', () => {
    const { xml } = renderMacosInfoPlist(resolveMacosDesktop({ ...browser, defaultBrowser: true, urlSchemes: ['stacks-browser'] }, '1.0.0'))
    lint(xml)
    const plist = parse(xml)
    expect(plist.CFBundleURLTypes).toEqual([
      { CFBundleURLName: 'com.stacksjs.browser', CFBundleURLSchemes: ['stacks-browser'] },
      { CFBundleURLName: 'Web site URL', CFBundleTypeRole: 'Viewer', CFBundleURLSchemes: ['http', 'https'] },
    ])
    const documents = plist.CFBundleDocumentTypes as Array<{ LSItemContentTypes: string[], LSHandlerRank: string, CFBundleTypeRole: string }>
    expect(documents.flatMap(type => type.LSItemContentTypes)).toEqual(['public.html', 'public.xhtml', 'com.apple.webarchive', 'com.adobe.pdf'])
    expect(documents.every(type => type.LSHandlerRank === 'Default' && type.CFBundleTypeRole === 'Viewer')).toBe(true)
    expect(plist.NSAppTransportSecurity).toEqual({ NSAllowsArbitraryLoadsInWebContent: true })
  })

  test('owns CFBundleDocumentTypes only when it is on', () => {
    const declared = { infoPlist: { CFBundleDocumentTypes: [{ CFBundleTypeName: 'Mine' }] } }
    expect(renderMacosInfoPlist(resolveMacosDesktop({ ...browser, ...declared, defaultBrowser: true }, '1.0.0')).ignored).toContain('CFBundleDocumentTypes')
    const plain = renderMacosInfoPlist(resolveMacosDesktop({ ...browser, ...declared }, '1.0.0'))
    expect(plain.ignored).not.toContain('CFBundleDocumentTypes')
    expect(plain.xml).toContain('<string>Mine</string>')
  })

  test('an app that is not a browser declares neither', () => {
    const { xml } = renderMacosInfoPlist(resolveMacosDesktop(browser, '1.0.0'))
    expect(xml).not.toContain('CFBundleDocumentTypes')
    expect(xml).not.toContain('CFBundleURLTypes')
    expect(xml).not.toContain('NSAppTransportSecurity')
  })
})

describe('macos.permissions', () => {
  const all = { network: true, camera: 'Video calls.', microphone: true, location: true, downloads: true, printing: true } as const

  onMac('writes each usage sentence, preferring the app\'s own', () => {
    const { xml } = renderMacosInfoPlist(resolveMacosDesktop({ ...browser, permissions: all, usageDescriptions: { NSMicrophoneUsageDescription: 'Voice notes.' } }, '1.0.0'))
    lint(xml)
    const plist = parse(xml)
    expect(plist.NSCameraUsageDescription).toBe('Video calls.')
    expect(plist.NSMicrophoneUsageDescription).toBe('Voice notes.')
    expect(plist.NSLocationUsageDescription).toBe(defaultUsageDescriptions('Browser').location)
    expect(plist.NSLocationWhenInUseUsageDescription).toBe(defaultUsageDescriptions('Browser').location)
  })

  test('adds each entitlement, sandboxed', () => {
    const xml = renderMacosEntitlements(resolveMacosDesktop({ ...browser, permissions: all }, '1.0.0'), 'development')
    lint(xml)
    for (const key of ['network.client', 'device.camera', 'device.audio-input', 'personal-information.location', 'files.downloads.read-write', 'print'])
      expect(xml).toContain(`<key>com.apple.security.${key}</key><true/>`)
  })

  test('read-only Downloads, and no network when the app says so', () => {
    const xml = renderMacosEntitlements(resolveMacosDesktop({ ...browser, permissions: { downloads: 'read-only', network: false } }, '1.0.0'), 'development')
    expect(xml).toContain('com.apple.security.files.downloads.read-only')
    expect(xml).not.toContain('downloads.read-write')
    expect(xml).not.toContain('network.client')
  })

  test('unsandboxed, only the devices the hardened runtime gates remain', () => {
    const xml = renderMacosEntitlements(resolveMacosDesktop({ ...browser, sandbox: false, permissions: all }, '1.0.0'), 'development')
    expect(xml).toContain('com.apple.security.device.camera')
    expect(xml).not.toContain('app-sandbox')
    expect(xml).not.toContain('files.downloads')
    expect(xml).not.toContain('security.print')
  })

  test('asks for nothing it was not given', () => {
    const { xml } = renderMacosInfoPlist(resolveMacosDesktop(browser, '1.0.0'))
    expect(xml).not.toContain('UsageDescription')
  })
})

describe('macos.window.trafficLights', () => {
  test('reach the host in craft-app.json and on the development command line', () => {
    const resolved = resolveMacosDesktop({ ...browser, window: { titlebarStyle: 'transparent', trafficLights: [18, 15] } }, '1.0.0')
    expect(JSON.parse(renderHostConfig(resolved)).trafficLights).toEqual([18, 15])
    const args = hostArguments({ ...resolved, url: 'http://127.0.0.1:9' }, 'screen.js')
    expect(args.slice(args.indexOf('--traffic-lights'), args.indexOf('--traffic-lights') + 2)).toEqual(['--traffic-lights', '18,15'])
  })

  test('are absent when unset, and refused when they are not two points', () => {
    const resolved = resolveMacosDesktop(browser, '1.0.0')
    expect(JSON.parse(renderHostConfig(resolved)).trafficLights).toBeUndefined()
    expect(hostArguments({ ...resolved, url: 'http://127.0.0.1:9' }, 'screen.js')).not.toContain('--traffic-lights')
    expect(validateMacosDesktop(resolveMacosDesktop({ ...browser, window: { trafficLights: [18] as unknown as [number, number] } }, '1.0.0')).join(' ')).toContain('trafficLights')
  })
})

describe('macos.dockMenu and macos.webkit', () => {
  test('reach the host through craft-app.json', () => {
    const config = JSON.parse(renderHostConfig(resolveMacosDesktop({ ...browser, webkit: true, dockMenu: [{ title: 'New Window', action: 'new-window' }] }, '1.0.0')))
    expect(config.webkit).toBe(true)
    expect(config.dockMenu).toEqual([{ title: 'New Window', action: 'new-window' }])
  })

  test('are absent when unset', () => {
    const config = JSON.parse(renderHostConfig(resolveMacosDesktop(browser, '1.0.0')))
    expect(config.webkit).toBeUndefined()
    expect(config.dockMenu).toBeUndefined()
  })

  test('a dock item needs a title and an action', () => {
    const errors = validateMacosDesktop(resolveMacosDesktop({ ...browser, dockMenu: [{ title: '', action: 'x' }, { title: 'Y', action: '' }] }, '1.0.0'))
    expect(errors).toEqual(['macos.dockMenu[0] needs a title', 'macos.dockMenu[1] needs an action'])
  })
})
