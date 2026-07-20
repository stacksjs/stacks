import type { ExtensionConfig } from '../src/types'
import { mkdtempSync, rmSync } from 'node:fs'
import { existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { resolveOutdir, rewriteBrowserNamespace } from '../src/build'
import { generateManifest } from '../src/manifest'
import { migrateSafariResourceBuildPhase, resolveSafariPlatforms, safariPackagerArgs, scaffoldSafariApp, safariAppName, syncSafariResources } from '../src/safari'

const config: ExtensionConfig = {
  name: 'Test Extension',
  description: 'Fixture config for the safari target.',
  geckoId: 'extension@example.com',
  safariBundleId: 'com.example.TestExtension',
  safariTeamId: 'TEAM123456',
  safariPlatforms: ['macos', 'ios'],
  safariExclude: ['marketing.html', 'marketing.js'],
  background: 'src/background/index.ts',
  content: [
    { entry: 'src/content/index.ts', matches: ['<all_urls>'], world: 'MAIN', matchAboutBlank: true },
  ],
  pages: { popup: { template: 'pages/popup.stx', script: 'src/ui/popup.ts' } },
  icons: { 128: 'icons/icon-128.png' },
  manifest: {
    permissions: ['declarativeNetRequest', 'storage'],
    minimumChromeVersion: '111',
    firefoxMinVersion: '142.0',
  },
}

describe('generateManifest (safari)', () => {
  const manifest = generateManifest(config, { version: '1.2.3', target: 'safari' })

  it('drops chrome-only keys', () => {
    expect(manifest.minimum_chrome_version).toBeUndefined()
  })

  it('uses a classic service worker background (no module hint)', () => {
    expect(manifest.background).toEqual({ service_worker: 'background.js' })
  })

  it('pins browser_specific_settings.safari.strict_min_version to 18.4 by default', () => {
    expect(manifest.browser_specific_settings).toEqual({ safari: { strict_min_version: '18.4' } })
  })

  it('honors manifest.safariMinVersion overrides', () => {
    const overridden = generateManifest({ ...config, manifest: { ...config.manifest, safariMinVersion: '26.0' } }, { version: '1.2.3', target: 'safari' })
    expect(overridden.browser_specific_settings).toEqual({ safari: { strict_min_version: '26.0' } })
  })

  it('keeps shared keys (permissions, content scripts, icons)', () => {
    expect(manifest.permissions).toEqual(['declarativeNetRequest', 'storage'])
    expect(manifest.content_scripts?.[0]).toMatchObject({ world: 'MAIN', match_about_blank: true })
    expect(manifest.icons).toEqual({ 128: 'icons/icon-128.png' })
  })

  it('does not leak safari settings into chrome/firefox manifests', () => {
    expect(generateManifest(config, { version: '1', target: 'chrome' }).browser_specific_settings).toBeUndefined()
    const firefox = generateManifest(config, { version: '1', target: 'firefox' }).browser_specific_settings
    expect(firefox && 'gecko' in firefox).toBe(true)
  })

  it('defaults Firefox to the first version supporting data collection declarations', () => {
    const firefox = generateManifest({ ...config, manifest: { ...config.manifest, firefoxMinVersion: undefined } }, { version: '1', target: 'firefox' })
    expect(firefox.browser_specific_settings).toEqual({
      gecko: {
        id: 'extension@example.com',
        strict_min_version: '142.0',
        data_collection_permissions: { required: ['none'] },
      },
    })
  })
})

describe('resolveOutdir', () => {
  it('maps targets to dist directories', () => {
    expect(resolveOutdir(config, 'chrome')).toBe('dist')
    expect(resolveOutdir(config, 'firefox')).toBe('dist-firefox')
    expect(resolveOutdir(config, 'safari')).toBe('dist-safari')
  })
})

describe('rewriteBrowserNamespace', () => {
  it('rewrites known chrome.* API access to browser.*', () => {
    const { code, replacements } = rewriteBrowserNamespace('await chrome.storage.sync.get("x"); chrome.tabs.create({})')
    expect(replacements).toBe(2)
    expect(code).toBe('await browser.storage.sync.get("x"); browser.tabs.create({})')
  })

  it('rewrites optional-chained namespaces (chrome.alarms?.)', () => {
    const { code, replacements } = rewriteBrowserNamespace('chrome.alarms?.create("a", { when: 1 })')
    expect(replacements).toBe(1)
    expect(code).toBe('browser.alarms?.create("a", { when: 1 })')
  })

  it('never touches string literals or unknown namespaces', () => {
    const input = '"Chrome 126 on macOS"; chrome.somethingCustom(); chromex.runtime.id'
    expect(rewriteBrowserNamespace(input)).toEqual({ code: input, replacements: 0 })
  })
})

describe('safariAppName', () => {
  it('strips spaces and punctuation', () => {
    expect(safariAppName(config)).toBe('TestExtension')
    expect(safariAppName({ ...config, name: 'Very Good AdBlock' })).toBe('VeryGoodAdBlock')
  })
})

describe('Safari universal platforms', () => {
  it('uses configured platforms and de-duplicates explicit overrides', () => {
    expect(resolveSafariPlatforms(config)).toEqual(['macos', 'ios'])
    expect(resolveSafariPlatforms(config, ['ios', 'macos', 'ios'])).toEqual(['ios', 'macos'])
    expect(resolveSafariPlatforms({ ...config, safariPlatforms: undefined })).toEqual(['macos'])
  })

  it('lets the Apple packager create both platforms from one web bundle', () => {
    const base = safariPackagerArgs('/tmp/input', '/tmp/output', 'TestExtension', 'com.example.TestExtension', ['macos', 'ios'])
    expect(base[0]).toBe('safari-web-extension-packager')
    expect(base).not.toContain('--macos-only')
    expect(base).not.toContain('--ios-only')
    expect(base.at(-1)).toBe('/tmp/input')

    expect(safariPackagerArgs('/tmp/input', '/tmp/output', 'TestExtension', 'com.example.TestExtension', ['ios'])).toContain('--ios-only')
    expect(safariPackagerArgs('/tmp/input', '/tmp/output', 'TestExtension', 'com.example.TestExtension', ['macos'])).toContain('--macos-only')
  })
})

describe('safari scaffold + sync', () => {
  let cwd: string

  beforeEach(() => {
    cwd = mkdtempSync(join(tmpdir(), 'browser-extension-safari-'))
  })

  afterEach(() => {
    rmSync(cwd, { recursive: true, force: true })
  })

  it('scaffolds the Xcode project with substituted identifiers', async () => {
    const { dir, written } = await scaffoldSafariApp(config, { cwd, version: '1.2.3' })
    expect(dir).toBe(join(cwd, 'safari'))
    expect(written.length).toBeGreaterThan(10)

    const pbxproj = await Bun.file(join(dir, 'TestExtension.xcodeproj', 'project.pbxproj')).text()
    expect(pbxproj).toContain('PRODUCT_BUNDLE_IDENTIFIER = com.example.TestExtension;')
    expect(pbxproj).toContain('PRODUCT_BUNDLE_IDENTIFIER = com.example.TestExtension.Extension;')
    expect(pbxproj).toContain('MARKETING_VERSION = 1.2.3;')
    expect(pbxproj).toContain('DEVELOPMENT_TEAM = "TEAM123456";')
    expect(pbxproj).not.toContain('__APP_NAME__')
    expect(pbxproj).toContain('Copy Web Extension Resources')
    expect(pbxproj).toContain('Resources.inputs.xcfilelist')
    expect(pbxproj).toContain('Resources.outputs.xcfilelist')
    expect(pbxproj).not.toContain('Resources in Resources')

    const appPlist = await Bun.file(join(dir, 'TestExtension', 'Info.plist')).text()
    expect(appPlist).toContain('<string>Test Extension</string>')

    const extPlist = await Bun.file(join(dir, 'TestExtension Extension', 'Info.plist')).text()
    expect(extPlist).toContain('com.apple.Safari.web-extension')

    const appSwift = await Bun.file(join(dir, 'TestExtension', 'TestExtensionApp.swift')).text()
    expect(appSwift).toContain('struct TestExtensionApp: App')

    const view = await Bun.file(join(dir, 'TestExtension', 'ContentView.swift')).text()
    expect(view).toContain('"com.example.TestExtension.Extension"')
  })

  it('is idempotent without --force and overwrites with it', async () => {
    await scaffoldSafariApp(config, { cwd })
    const marker = join(cwd, 'safari', 'TestExtension', 'Info.plist')
    await Bun.write(marker, 'custom')
    const again = await scaffoldSafariApp(config, { cwd })
    expect(await Bun.file(marker).text()).toBe('custom')
    expect(again.written.length).toBe(0)
    expect(again.skipped.length).toBeGreaterThan(10)

    const forced = await scaffoldSafariApp(config, { cwd, force: true })
    expect(forced.written.length).toBeGreaterThan(10)
    expect(await Bun.file(marker).text()).not.toBe('custom')
  })

  it('warns and uses a placeholder bundle id when none is configured', async () => {
    const { dir } = await scaffoldSafariApp({ ...config, safariBundleId: undefined }, { cwd })
    const pbxproj = await Bun.file(join(dir, 'TestExtension.xcodeproj', 'project.pbxproj')).text()
    expect(pbxproj).toContain('com.example.testextension.Extension')
  })

  it('syncs the built bundle into the appex Resources, honoring safariExclude', async () => {
    const outdir = join(cwd, 'dist-safari')
    await Bun.write(join(outdir, 'manifest.json'), '{}')
    await Bun.write(join(outdir, 'background.js'), 'browser.runtime.id')
    await Bun.write(join(outdir, 'rules', 'static.json'), '[]')
    await Bun.write(join(outdir, 'marketing.html'), 'site only')
    await Bun.write(join(outdir, 'marketing.js'), 'site only')

    await scaffoldSafariApp(config, { cwd })
    const { resources, files } = await syncSafariResources(config, { cwd })

    expect(files).toBe(3)
    expect(existsSync(join(resources, 'manifest.json'))).toBe(true)
    expect(existsSync(join(resources, 'background.js'))).toBe(true)
    expect(existsSync(join(resources, 'rules', 'static.json'))).toBe(true)
    expect(existsSync(join(resources, 'marketing.html'))).toBe(false)
    expect(existsSync(join(resources, 'marketing.js'))).toBe(false)

    const inputs = await Bun.file(join(cwd, 'safari', 'TestExtension Extension', 'Resources.inputs.xcfilelist')).text()
    const outputs = await Bun.file(join(cwd, 'safari', 'TestExtension Extension', 'Resources.outputs.xcfilelist')).text()
    expect(inputs.trim().split('\n')).toEqual([
      '$(SRCROOT)/TestExtension Extension/Resources/background.js',
      '$(SRCROOT)/TestExtension Extension/Resources/manifest.json',
      '$(SRCROOT)/TestExtension Extension/Resources/rules/static.json',
    ])
    expect(outputs.trim().split('\n')).toEqual([
      '$(TARGET_BUILD_DIR)/$(UNLOCALIZED_RESOURCES_FOLDER_PATH)/background.js',
      '$(TARGET_BUILD_DIR)/$(UNLOCALIZED_RESOURCES_FOLDER_PATH)/manifest.json',
      '$(TARGET_BUILD_DIR)/$(UNLOCALIZED_RESOURCES_FOLDER_PATH)/rules/static.json',
    ])
  })

  it('sync clears stale files from previous runs', async () => {
    const outdir = join(cwd, 'dist-safari')
    await Bun.write(join(outdir, 'manifest.json'), '{}')
    await scaffoldSafariApp(config, { cwd })
    const { resources } = await syncSafariResources(config, { cwd })
    await Bun.write(join(resources, 'stale.js'), 'old')

    await syncSafariResources(config, { cwd })
    expect(existsSync(join(resources, 'stale.js'))).toBe(false)
    expect(existsSync(join(resources, 'manifest.json'))).toBe(true)
  })

  it('migrates legacy projects that nested the web extension resources', () => {
    const legacy = `
0C0000000000000000000023 /* Resources in Resources */ = {isa = PBXBuildFile; fileRef = 0B0000000000000000000023 /* Resources */; };
\t\t\t\t0D0000000000000000000022 /* Resources */,
\t\t\t\t0C0000000000000000000023 /* Resources in Resources */,
/* Begin PBXSourcesBuildPhase section */
`
    const migrated = migrateSafariResourceBuildPhase(legacy, 'TestExtension')
    expect(migrated).toContain('Copy Web Extension Resources')
    expect(migrated).toContain('Resources.inputs.xcfilelist')
    expect(migrated).toContain('Resources.outputs.xcfilelist')
    expect(migrated).not.toContain('Resources in Resources')
  })
})
