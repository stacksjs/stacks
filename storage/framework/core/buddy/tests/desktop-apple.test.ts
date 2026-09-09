import { describe, expect, test } from 'bun:test'
import { resolve } from 'node:path'
import {
  renderAppEntitlements,
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
 * `desktop:apple:doctor` exists to name what is missing, so what it prints is
 * its entire output contract. It has been wrong in both directions: first
 * silent, because `await log.error()` resolves on its own schedule and
 * `process.exit()` tore the process down first, leaving a bare exit code 1;
 * then doubled, because the fix for that wrote through `process.stderr.write`
 * *and* `console.error` and both go to stderr. Eleven missing credentials
 * listed twice reads like two runs disagreeing about nothing.
 *
 * Driving the real command in a subprocess is the only way to see this: the
 * duplication lived in a helper that neither exports nor returns anything.
 */
describe('desktop:apple:doctor output', () => {
  test('prints each missing prerequisite exactly once, and exits non-zero', async () => {
    const root = new URL('../../../../../', import.meta.url).pathname
    /*
     * This package's own CLI entrypoint, not the `./buddy` shim.
     *
     * The shim bootstraps pantry when `pantry/` is missing or half-finished,
     * which on a CI runner that has only run `bun install` means a full
     * provisioning run happening inside a test, with a 600s timeout, writing a
     * tree that every package tested afterwards resolves through. Nothing here
     * wants that; it wants one process's stderr.
     *
     * Resolved relative to this file rather than to the project root: an
     * application that installs the framework from npm has no
     * `storage/framework/core/`, and a path assuming one is wrong everywhere
     * except a vendored checkout. This test ships inside the buddy package, so
     * `../src/cli.ts` is next to it in every layout.
     */
    const cli = resolve(import.meta.dir, '../src/cli.ts')
    const result = Bun.spawnSync(['bun', cli, 'desktop:apple:doctor'], {
      cwd: root,
      stdout: 'pipe',
      stderr: 'pipe',
      // A machine that really has these configured would pass the check and
      // print nothing to assert on.
      env: {
        ...process.env,
        APPLE_BUNDLE_ID: '',
        APPLE_TEAM_ID: '',
        APPLE_APP_SIGNING_IDENTITY: '',
        APPLE_INSTALLER_SIGNING_IDENTITY: '',
        APPLE_PROVISIONING_PROFILE: '',
        APP_STORE_CONNECT_API_KEY_ID: '',
        APP_STORE_CONNECT_API_ISSUER_ID: '',
        APP_STORE_CONNECT_API_KEY_PATH: '',
      },
    })

    const output = `${result.stdout.toString()}${result.stderr.toString()}`
    const occurrences = (needle: string) => output.split(needle).length - 1

    expect(result.exitCode).not.toBe(0)
    expect(occurrences('APPLE_TEAM_ID must be')).toBe(1)
    expect(occurrences('APP_STORE_CONNECT_API_KEY_ID is required')).toBe(1)
  }, 30000)
})
