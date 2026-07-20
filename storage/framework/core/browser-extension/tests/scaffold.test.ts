import { existsSync, mkdtempSync } from 'node:fs'
import { rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'bun:test'
import { buildExtension } from '../src/build'
import { resolveExtensionScaffoldTargets, scaffoldExtensionProject } from '../src/scaffold'

describe('extension project scaffold', () => {
  const dirs: string[] = []

  afterEach(async () => {
    await Promise.all(dirs.splice(0).map(dir => rm(dir, { recursive: true, force: true })))
  })

  it('defaults to all browser targets', () => {
    expect(resolveExtensionScaffoldTargets()).toEqual(['chrome', 'firefox', 'safari'])
    expect(resolveExtensionScaffoldTargets('safari')).toEqual(['safari'])
  })

  it('bootstraps a buildable Safari extension and Xcode container together', async () => {
    const cwd = mkdtempSync(join(tmpdir(), 'browser-extension-scaffold-'))
    dirs.push(cwd)
    const result = await scaffoldExtensionProject({
      cwd,
      name: 'Privacy Helper',
      target: 'safari',
      bundleId: 'org.example.PrivacyHelper',
      teamId: 'TEAM123456',
      platforms: ['macos', 'ios'],
      version: '1.2.3',
    })

    expect(result.config.targets).toEqual(['safari'])
    expect(result.config.safariPlatforms).toEqual(['macos', 'ios'])
    expect(existsSync(join(cwd, 'resources/views/popup.stx'))).toBe(true)
    expect(existsSync(join(cwd, 'resources/scripts/popup.ts'))).toBe(true)
    expect(existsSync(join(cwd, 'safari/PrivacyHelper.xcodeproj/project.pbxproj'))).toBe(true)

    const config = await Bun.file(join(cwd, 'config/extension.ts')).text()
    expect(config).toContain("targets: ['safari']")
    expect(config).toContain("safariBundleId: 'org.example.PrivacyHelper'")
    expect(config).toContain("safariPlatforms: ['macos', 'ios']")
    expect(config).toContain("script: 'resources/scripts/popup.ts'")

    const project = await Bun.file(join(cwd, 'safari/PrivacyHelper.xcodeproj/project.pbxproj')).text()
    expect(project).toContain('PRODUCT_BUNDLE_IDENTIFIER = org.example.PrivacyHelper;')
    expect(project).toContain('DEVELOPMENT_TEAM = "TEAM123456";')

    const { outdir } = await buildExtension(result.config, { cwd, target: 'safari', version: '1.2.3', minify: false })
    expect(existsSync(join(outdir, 'manifest.json'))).toBe(true)
    expect(existsSync(join(outdir, 'popup.html'))).toBe(true)
    expect(existsSync(join(outdir, 'background.js'))).toBe(true)
  })
})
