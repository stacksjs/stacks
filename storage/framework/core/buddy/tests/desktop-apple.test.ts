import { describe, expect, it, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  renderAppEntitlements,
  renderFailure,
  renderAppleWorkflowCaller,
  renderHelperEntitlements,
  renderInfoPlist,
  validateAppleDesktopConfig,
} from '../src/commands/desktop-apple'

const config = {
  appName: 'Postline & Co',
  bundleId: 'com.stacksjs.postline',
  teamId: 'ABCDEFGHIJ',
  version: '1.2.3',
  buildNumber: '42',
  minimumMacos: '13.0',
  category: 'public.app-category.productivity',
  appSigningIdentity: 'Mac App Distribution: Stacks (ABCDEFGHIJ)',
  installerSigningIdentity: 'Mac Installer Distribution: Stacks (ABCDEFGHIJ)',
  provisioningProfile: '/tmp/postline.provisionprofile',
  apiKeyId: 'KEY123',
  apiIssuerId: 'issuer-id',
  apiKeyPath: '/tmp/AuthKey_KEY123.p8',
}

describe('Mac App Store desktop automation', () => {
  test('renders escaped bundle metadata', () => {
    const plist = renderInfoPlist(config)
    expect(plist).toContain('<string>Postline &amp; Co</string>')
    expect(plist).toContain('<string>com.stacksjs.postline</string>')
    expect(plist).toContain('<string>42</string>')
    expect(plist).toContain('<string>public.app-category.productivity</string>')
  })

  test('uses a parent sandbox and inherited helper sandbox', () => {
    const app = renderAppEntitlements(config)
    const helper = renderHelperEntitlements()
    expect(app).toContain('<key>com.apple.security.app-sandbox</key>')
    expect(app).toContain('<key>com.apple.security.network.client</key>')
    expect(app).toContain('<string>ABCDEFGHIJ.com.stacksjs.postline</string>')
    expect(helper).toContain('<key>com.apple.security.inherit</key>')
    expect(helper).not.toContain('<key>com.apple.security.network.client</key>')
  })

  test('generates a reusable workflow caller with validation on by default', () => {
    const workflow = renderAppleWorkflowCaller()
    expect(workflow).toContain('uses: stacksjs/stacks/.github/workflows/desktop-app-store.yml@main')
    expect(workflow).toContain('desktop-url: ${{ vars.DESKTOP_URL }}')
    expect(workflow).toContain('app-version: ${{ vars.APPLE_APP_VERSION }}')
    expect(workflow).toContain('release-tag: ${{ inputs.release-tag }}')
    expect(workflow).toContain('mirror-s3: ${{ inputs.mirror-s3 }}')
    expect(workflow).toContain('s3-bucket: ${{ vars.RELEASE_S3_BUCKET }}')
    expect(workflow).toContain('validate-only:')
    expect(workflow).toContain('secrets: inherit')
  })

  test('reports malformed and missing release inputs before packaging', () => {
    const errors = validateAppleDesktopConfig({
      ...config,
      bundleId: 'not a bundle id',
      teamId: 'short',
      version: 'version-one',
      buildNumber: 'build 1',
      provisioningProfile: '',
      apiKeyPath: '',
    })
    expect(errors).toContain('APPLE_BUNDLE_ID must be a reverse-DNS bundle identifier')
    expect(errors).toContain('APPLE_TEAM_ID must be the 10-character Apple Developer team ID')
    expect(errors).toContain('The marketing version must contain one to three numeric components')
    expect(errors).toContain('The build number must contain only letters, numbers, periods, and hyphens')
    expect(errors).toContain('APPLE_PROVISIONING_PROFILE must point to an existing .provisionprofile file')
    expect(errors).toContain('APP_STORE_CONNECT_API_KEY_PATH must point to an existing .p8 file')
  })
})

/**
 * A failure prints its message once.
 *
 * `desktop:apple:doctor` exists to name what is missing, so what it prints is
 * its whole output contract, and that contract has been wrong in both
 * directions. First silent: `await log.error()` resolves on its own schedule
 * and `process.exit()` tore the process down first, so the command reported a
 * bare exit code 1 and no diagnosis. Then doubled: the fix arrived as
 * `process.stderr.write` *and* `console.error`, and both go to stderr, so
 * eleven missing credentials were listed and then listed again.
 *
 * Asserted on the rendered value and on the source, rather than by running the
 * command. An earlier version of this test spawned the CLI, which is not free:
 * it refuses to start outside a Stacks project, and inside one it writes - a
 * bare `bun cli.ts` in an empty directory creates `storage/`. A test that
 * mutates the tree every other package is then tested against is a bad trade
 * for observing one string.
 */
describe('desktop:apple:doctor output', () => {
  it('renders the message once, with a trailing newline', () => {
    expect(renderFailure(new Error('APPLE_TEAM_ID is required'))).toBe('APPLE_TEAM_ID is required\n')
    expect(renderFailure('plain string')).toBe('plain string\n')
  })

  it('keeps every line of a multi-line diagnosis', () => {
    // The doctor's real shape: one line per missing prerequisite, joined.
    const message = ['APPLE_BUNDLE_ID must be a reverse-DNS bundle identifier', 'APPLE_TEAM_ID is required'].join('\n')

    expect(renderFailure(new Error(message))).toBe(`${message}\n`)
  })

  /**
   * The invariant that actually broke, and it is a property of the source
   * rather than of any value: two writes to stderr print twice however
   * correctly each one renders. Source-scanned because `fail` ends in
   * `process.exit` and cannot be called in-process.
   */
  it('writes to stderr exactly once', () => {
    const source = readFileSync(resolve(import.meta.dir, '../src/commands/desktop-apple.ts'), 'utf-8')
    const body = source.slice(source.indexOf('function fail('), source.indexOf('export function desktopApple('))

    expect(body).toContain('process.exit(1)')
    expect(body.match(/process\.stderr\.write\(|console\.(?:error|warn|log)\(/g) ?? []).toHaveLength(1)
  })
})
