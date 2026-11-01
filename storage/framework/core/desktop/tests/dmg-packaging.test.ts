import { describe, expect, it } from 'bun:test'
import { notarytoolAuthArgs, resolveDmgPackaging } from '../src'

/**
 * How `build:dmg` decides what to call and how to sign a bundle.
 *
 * The command took no flags at all: every one of these values could only be
 * given as a `DESKTOP_*` environment variable, so packaging a signed release by
 * hand meant exporting four of them, and anything that wrapped that became a
 * script whose only job was to set variables and call `buddy`. Which is how an
 * application ends up owning a build script, the thing #2884, #2885, #2889 and
 * #2890 were each a symptom of.
 *
 * `desktop:apple`, the Mac App Store command in this same framework, already
 * resolved its inputs as `flag || env(...) || packageJson` with a flag for
 * each. This is the same shape, so the two commands no longer disagree about
 * how a Mac build is configured.
 *
 * Verified through the real command as well as here: `buddy build:dmg
 * --app-name "Via Buddy" --app-version 5.5.5 --bundle-id com.example.viabuddy`
 * produced a mounted bundle carrying exactly those three.
 */

const NOTHING = { flags: {}, env: {} }

describe('resolveDmgPackaging', () => {
  describe('precedence', () => {
    it('prefers a flag to the environment', () => {
      const resolved = resolveDmgPackaging({
        flags: { appName: 'Flag Wins', appVersion: '7.7.7', bundleId: 'com.flag.id' },
        env: { DESKTOP_APP_NAME: 'Env App', DESKTOP_APP_VERSION: '1.1.1', DESKTOP_BUNDLE_ID: 'com.env.id' },
      })
      expect(resolved.appName).toBe('Flag Wins')
      expect(resolved.version).toBe('7.7.7')
      expect(resolved.bundleId).toBe('com.flag.id')
    })

    it('uses the environment when no flag was passed, which is the CI case', () => {
      const resolved = resolveDmgPackaging({
        env: { DESKTOP_APP_NAME: 'Env App', DESKTOP_APP_VERSION: '1.1.1', DESKTOP_SIGNING_IDENTITY: 'Developer ID Application: Acme' },
      })
      expect(resolved.appName).toBe('Env App')
      expect(resolved.version).toBe('1.1.1')
      expect(resolved.signingIdentity).toBe('Developer ID Application: Acme')
    })

    it('falls back through the manifest title to APP_NAME to Stacks', () => {
      expect(resolveDmgPackaging({ manifestTitle: 'From Manifest', env: { APP_NAME: 'From Env' } }).appName).toBe('From Manifest')
      expect(resolveDmgPackaging({ env: { APP_NAME: 'From Env' } }).appName).toBe('From Env')
      expect(resolveDmgPackaging(NOTHING).appName).toBe('Stacks')
      expect(resolveDmgPackaging().appName).toBe('Stacks')
    })

    it("reads the version from the project when nobody stated one", () => {
      expect(resolveDmgPackaging({ declaredVersion: '0.70.52' }).version).toBe('0.70.52')
      // A flag or a variable is something a person stated for THIS build, so
      // either outranks what package.json happens to say.
      expect(resolveDmgPackaging({ declaredVersion: '0.70.52', env: { DESKTOP_APP_VERSION: '2.0.0' } }).version).toBe('2.0.0')
      expect(resolveDmgPackaging({ declaredVersion: '0.70.52', flags: { appVersion: '3.0.0' } }).version).toBe('3.0.0')
    })
  })

  describe('values that are not answers', () => {
    it('ignores a flag declared without an argument', () => {
      // `--app-name` with nothing after it arrives as boolean true, and using
      // "true" as the app's name would be worse than falling through.
      const resolved = resolveDmgPackaging({
        flags: { appName: true, appVersion: true, bundleId: true, signingIdentity: true, volumeName: true },
        env: { DESKTOP_APP_NAME: 'Env App', DESKTOP_APP_VERSION: '1.1.1' },
      })
      expect(resolved.appName).toBe('Env App')
      expect(resolved.version).toBe('1.1.1')
      expect(resolved.signingIdentity).toBeUndefined()
      expect(resolved.bundleId).toBe('sh.stacks.env-app')
    })

    it('ignores a blank or whitespace value, however it arrived', () => {
      // An unset variable in CI commonly arrives as the empty string.
      const resolved = resolveDmgPackaging({
        flags: { appName: '   ' },
        env: { DESKTOP_APP_NAME: '', APP_NAME: 'Fallback', DESKTOP_SIGNING_IDENTITY: '  ' },
      })
      expect(resolved.appName).toBe('Fallback')
      expect(resolved.signingIdentity).toBeUndefined()
    })

    it('trims a value that is otherwise usable', () => {
      expect(resolveDmgPackaging({ flags: { appName: '  Padded  ' } }).appName).toBe('Padded')
      expect(resolveDmgPackaging({ env: { DESKTOP_APP_VERSION: ' 1.2.3\n' } }).version).toBe('1.2.3')
    })
  })

  describe('derived values', () => {
    it('derives a bundle id from the resolved name, not the raw input', () => {
      expect(resolveDmgPackaging({ flags: { appName: 'Repro & Co' } }).bundleId).toBe('sh.stacks.repro-co')
      expect(resolveDmgPackaging(NOTHING).bundleId).toBe('sh.stacks.stacks')
    })

    it('names the volume after the app and version, never the app alone (#2884)', () => {
      const resolved = resolveDmgPackaging({ flags: { appName: 'SystemCleaner', appVersion: '0.3.5' } })
      expect(resolved.volumeName).toBe('SystemCleaner 0.3.5')
      expect(resolved.volumeName).not.toBe(resolved.appName)
    })

    it('honours an explicit volume name verbatim', () => {
      // build:dmg warns when this equals the app name, because that is the
      // path macOS refuses; it is still the caller's choice to make.
      expect(resolveDmgPackaging({ flags: { appName: 'App', volumeName: 'My Custom Volume' } }).volumeName).toBe('My Custom Volume')
      expect(resolveDmgPackaging({ flags: { appName: 'App' }, env: { DESKTOP_VOLUME_NAME: 'From Env' } }).volumeName).toBe('From Env')
    })
  })

  describe('signing', () => {
    it('leaves both signing values unset when neither was supplied', () => {
      const resolved = resolveDmgPackaging(NOTHING)
      expect(resolved.signingIdentity).toBeUndefined()
      expect(resolved.notaryProfile).toBeUndefined()
    })

    it('takes a notary profile from a flag or the environment', () => {
      expect(resolveDmgPackaging({ flags: { notaryProfile: 'flag-profile' }, env: { DESKTOP_NOTARY_PROFILE: 'env-profile' } }).notaryProfile).toBe('flag-profile')
      expect(resolveDmgPackaging({ env: { DESKTOP_NOTARY_PROFILE: 'env-profile' } }).notaryProfile).toBe('env-profile')
      expect(resolveDmgPackaging({ env: { DESKTOP_NOTARY_PROFILE: 'env-profile' } }).notary).toEqual({ profile: 'env-profile' })
    })
  })

  describe('notarizing with an App Store Connect key', () => {
    const KEY = { APP_STORE_CONNECT_API_KEY_ID: 'C2PX86L7M9', APP_STORE_CONNECT_API_ISSUER_ID: 'issuer-uuid', APP_STORE_CONNECT_API_KEY_PATH: '/keys/AuthKey_C2PX86L7M9.p8' }
    const PEM = '-----BEGIN PRIVATE KEY-----\\nMIGT\\n-----END PRIVATE KEY-----'

    it('leaves a key unused unless notarizing was asked for', () => {
      // Apps hold this key for the Mac App Store; a DMG build should not start waiting on Apple because of it.
      expect(resolveDmgPackaging({ env: KEY }).notary).toBeUndefined()
    })

    it('uses the key when asked, by flag or environment', () => {
      const wanted = { keyId: 'C2PX86L7M9', issuerId: 'issuer-uuid', keyPath: '/keys/AuthKey_C2PX86L7M9.p8' }
      expect(resolveDmgPackaging({ flags: { notarize: true }, env: KEY }).notary).toEqual(wanted)
      expect(resolveDmgPackaging({ env: { ...KEY, DESKTOP_NOTARIZE: 'true' } }).notary).toEqual(wanted)
      expect(resolveDmgPackaging({ flags: { notarize: true, apiKeyId: 'FLAGKEY123', apiIssuerId: 'flag-issuer', apiKeyPath: '/flag.p8' }, env: KEY }).notary)
        .toEqual({ keyId: 'FLAGKEY123', issuerId: 'flag-issuer', keyPath: '/flag.p8' })
    })

    it('reads the key itself from an encrypted env value, restoring its line breaks', () => {
      const env = { APP_STORE_CONNECT_API_KEY_ID: 'C2PX86L7M9', APP_STORE_CONNECT_API_ISSUER_ID: 'issuer-uuid', APP_STORE_CONNECT_API_KEY: PEM }
      expect(resolveDmgPackaging({ flags: { notarize: true }, env }).notary)
        .toEqual({ keyId: 'C2PX86L7M9', issuerId: 'issuer-uuid', keyPem: '-----BEGIN PRIVATE KEY-----\nMIGT\n-----END PRIVATE KEY-----' })
    })

    it('prefers a keychain profile to a key', () => {
      expect(resolveDmgPackaging({ flags: { notarize: true, notaryProfile: 'profile' }, env: KEY }).notary).toEqual({ profile: 'profile' })
    })

    it('names what is missing when asked without complete credentials', () => {
      expect(() => resolveDmgPackaging({ flags: { notarize: true }, env: {} })).toThrow('APP_STORE_CONNECT_API_KEY_ID (--api-key-id), APP_STORE_CONNECT_API_ISSUER_ID (--api-issuer-id)')
      expect(() => resolveDmgPackaging({ flags: { notarize: true }, env: { APP_STORE_CONNECT_API_KEY_ID: 'K', APP_STORE_CONNECT_API_ISSUER_ID: 'I' } })).toThrow('APP_STORE_CONNECT_API_KEY_PATH')
      expect(() => resolveDmgPackaging({ flags: { notarize: true }, env: { APP_STORE_CONNECT_API_KEY_ID: 'K', APP_STORE_CONNECT_API_ISSUER_ID: 'I', APP_STORE_CONNECT_API_KEY: 'not a key' } })).toThrow('PEM text')
    })

    it('signs notarytool in with either kind of credential', () => {
      expect(notarytoolAuthArgs({ profile: 'p' })).toEqual(['--keychain-profile', 'p'])
      expect(notarytoolAuthArgs({ keyId: 'K', issuerId: 'I', keyPath: '/k.p8' })).toEqual(['--key', '/k.p8', '--key-id', 'K', '--issuer', 'I'])
    })
  })
})
