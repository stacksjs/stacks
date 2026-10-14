import { describe, expect, it } from 'bun:test'
import { mkdtempSync, readFileSync, rmSync, statSync, existsSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { androidCraftFeatures, androidRelease, toCraftAndroidConfig, uploadAndroidMapping } from '../src/build/android-config'
import { assertCraftSupportsCrashReporting, CRAFT_CRASH_REPORTING_FLOOR, resolveCrashReporting, toCraftIosConfig } from '../src/build/ios-config'
import { renderDsymUpload, writeIosShellSupport } from '../src/build/ios-shell'

const ios = { appName: 'Example', bundleId: 'org.example.app', url: 'https://example.org/m' }

describe('mobile crash reporting configuration', () => {
  it('lays a platform\'s settings over the shared ones, and is off without a key', () => {
    expect(resolveCrashReporting(undefined, undefined)).toBeUndefined()
    expect(resolveCrashReporting({ host: 'https://bughq.org' }, undefined)).toBeUndefined()
    expect(resolveCrashReporting({ host: 'https://bughq.org', environment: 'production' }, { key: 'bughq_ios', environment: '' }))
      .toEqual({ host: 'https://bughq.org', environment: 'production', key: 'bughq_ios' })
    expect(resolveCrashReporting({ key: 'shared' }, { key: 'bughq_ios' })?.key).toBe('bughq_ios')
  })

  it('refuses a plain-HTTP host outside local development', () => {
    expect(() => resolveCrashReporting({ key: 'k', host: 'http://bughq.example.com' }, undefined)).toThrow('HTTPS')
    expect(resolveCrashReporting({ key: 'k', host: 'http://localhost:3811/' }, undefined)?.host).toBe('http://localhost:3811')
  })

  it('writes only the runtime settings into craft.config.json, for both platforms', () => {
    const settings = { key: 'bughq_k', host: 'https://bughq.org', uploadSymbols: false }
    expect(toCraftIosConfig({ ...ios, crashReporting: settings }).crashReporting).toEqual({ key: 'bughq_k', host: 'https://bughq.org' })
    expect(toCraftIosConfig(ios).crashReporting).toBeUndefined()
    expect(toCraftAndroidConfig({ appName: 'Example', packageName: 'org.example.app', url: 'https://example.org/m', crashReporting: settings }).crashReporting)
      .toEqual({ key: 'bughq_k', host: 'https://bughq.org' })
  })

  it('refuses a Craft that would build the app without the reporter', () => {
    expect(() => assertCraftSupportsCrashReporting({ key: 'k' }, '0.0.175', 'node_modules/craft-native')).toThrow(`needs >= ${CRAFT_CRASH_REPORTING_FLOOR}`)
    expect(() => assertCraftSupportsCrashReporting({ key: 'k' }, CRAFT_CRASH_REPORTING_FLOOR, 'x')).not.toThrow()
    expect(() => assertCraftSupportsCrashReporting(undefined, '0.0.100', 'x')).not.toThrow()
    expect(androidCraftFeatures({ appName: 'A', packageName: 'a.b', crashReporting: { key: 'k' } })).toContain('crashReporting')
  })
})

describe('dSYM upload from Xcode Cloud', () => {
  it('uploads every archive dSYM after an archive, and skips without a token', () => {
    const script = renderDsymUpload('https://bughq.example.org')
    expect(script).toContain('[ "${CI_XCODEBUILD_ACTION:-}" = "archive" ] || exit 0')
    expect(script).toContain('"${CI_ARCHIVE_PATH}"/dSYMs/*.dSYM')
    expect(script).toContain('symbols -arch arm64 "$DSYM"')
    expect(script).toContain('HOST="${BUGHQ_HOST:-https://bughq.example.org}"')
    expect(script).toContain('/api/debug-files?kind=apple')
    expect(script).toContain('Authorization: Bearer $BUGHQ_UPLOAD_TOKEN')
    // A missing token or a failed upload never fails the release.
    expect(script.trim().endsWith('exit 0')).toBe(true)
  })

  it('is written only when crash reporting is on and symbols are wanted', () => {
    const output = mkdtempSync(join(tmpdir(), 'stacks-ios-crash-'))
    const path = join(output, 'ci_scripts/ci_post_xcodebuild.sh')
    try {
      writeIosShellSupport(output, ios, '1.3.0', { key: 'bughq_k' })
      expect(readFileSync(path, 'utf8')).toContain('https://bughq.org')
      expect(statSync(path).mode & 0o111).toBe(0o111)
      expect(Bun.spawnSync(['sh', '-n', path]).exitCode).toBe(0)
      // Without a token it explains itself and succeeds.
      const run = Bun.spawnSync(['sh', path], { env: { CI_XCODEBUILD_ACTION: 'archive', CI_ARCHIVE_PATH: output, PATH: process.env.PATH ?? '' } })
      expect(run.exitCode).toBe(0)
      expect(run.stdout.toString()).toContain('BUGHQ_UPLOAD_TOKEN is not set')
      writeIosShellSupport(output, ios, '1.3.0', { key: 'bughq_k', uploadSymbols: false })
      expect(existsSync(path)).toBe(false)
      writeIosShellSupport(output, ios, '1.3.0')
      expect(existsSync(path)).toBe(false)
    }
    finally { rmSync(output, { recursive: true, force: true }) }
  })
})

describe('R8 mapping upload', () => {
  it('names the release the app reports', () => {
    expect(androidRelease({ version: '1.0.0', versionCode: 41 })).toBe('1.0.0+41')
    expect(androidRelease({})).toBe('1.0.0+1')
    expect(androidRelease({ version: '2.0.0', versionCode: 3, crashReporting: { release: 'custom' } })).toBe('custom')
  })

  it('posts the gzipped mapping with the upload token, and reports rather than throws', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'stacks-mapping-'))
    try {
      const mapping = join(dir, 'mapping.txt')
      writeFileSync(mapping, 'com.example.Player -> a.b:\n    void start() -> c\n')
      const sent: Array<{ url: string, init: RequestInit }> = []
      const send = (async (url: string, init: RequestInit) => {
        sent.push({ url, init })
        return new Response('{"ok":true}', { status: 201 })
      }) as unknown as typeof fetch
      const result = await uploadAndroidMapping(mapping, 'https://bughq.org/', '1.0.0+41', 'bughq_up_x', send)
      expect(result.ok).toBe(true)
      expect(sent[0].url).toBe('https://bughq.org/api/debug-files?kind=proguard&release=1.0.0%2B41')
      expect((sent[0].init.headers as Record<string, string>).Authorization).toBe('Bearer bughq_up_x')
      expect(new TextDecoder().decode(Bun.gunzipSync(sent[0].init.body as Uint8Array))).toContain('com.example.Player -> a.b:')

      expect((await uploadAndroidMapping(mapping, 'https://bughq.org', '1', undefined, send)).message).toContain('BUGHQ_UPLOAD_TOKEN is not set')
      expect((await uploadAndroidMapping(join(dir, 'missing.txt'), 'https://bughq.org', '1', 't', send)).ok).toBe(false)
      const refuses = (async () => new Response('invalid upload token', { status: 401 })) as unknown as typeof fetch
      expect((await uploadAndroidMapping(mapping, 'https://bughq.org', '1', 't', refuses)).message).toContain('401')
      const offline = (async () => { throw new Error('offline') }) as unknown as typeof fetch
      expect((await uploadAndroidMapping(mapping, 'https://bughq.org', '1', 't', offline)).ok).toBe(false)
    }
    finally { rmSync(dir, { recursive: true, force: true }) }
  })
})
