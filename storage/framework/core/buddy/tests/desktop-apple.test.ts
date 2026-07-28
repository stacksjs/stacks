import { describe, expect, test } from 'bun:test'
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
