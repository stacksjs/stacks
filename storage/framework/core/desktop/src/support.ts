export type DesktopSupportStatus = 'stable' | 'experimental' | 'unsupported'

export interface DesktopSupportRow {
  platform: 'darwin' | 'linux' | 'win32'
  architecture: 'arm64' | 'x64'
  status: DesktopSupportStatus
  osVersions: string[]
  packageFormat: string
  signing: 'enforced' | 'pending'
  notarization: 'enforced' | 'pending' | 'not-applicable'
  installLaunchEvidence: string | null
  updateRollbackEvidence: string | null
  packagingEvidence: string
  blockingIssues: string[]
  limitations: string[]
}

export const desktopSupportMatrix: readonly DesktopSupportRow[] = [
  { platform: 'darwin', architecture: 'arm64', status: 'experimental', osVersions: ['macOS 15 runner'], packageFormat: 'DMG + PKG', signing: 'pending', notarization: 'pending', installLaunchEvidence: 'https://github.com/stacksjs/stacks/actions/runs/29890804159', updateRollbackEvidence: 'https://github.com/stacksjs/stacks/actions/runs/29890804159', packagingEvidence: 'https://github.com/stacksjs/protocol/blob/main/evidence/craft.json', blockingIssues: ['https://github.com/stacksjs/stacks/issues/2062'], limitations: ['Lifecycle fixtures are unsigned while platform identities remain unprovisioned.', 'Lifecycle evidence was produced against Craft v0.0.48 built from source (bf75807). Craft now publishes a prebuilt craft-darwin-arm64.zip with every release, and no Stacks lifecycle run has re-verified a prebuilt release yet.'] },
  { platform: 'darwin', architecture: 'x64', status: 'experimental', osVersions: ['macOS 15 Intel runner'], packageFormat: 'DMG + PKG', signing: 'pending', notarization: 'pending', installLaunchEvidence: 'https://github.com/stacksjs/stacks/actions/runs/29890804159', updateRollbackEvidence: 'https://github.com/stacksjs/stacks/actions/runs/29890804159', packagingEvidence: 'https://github.com/stacksjs/protocol/blob/main/evidence/craft.json', blockingIssues: ['https://github.com/stacksjs/stacks/issues/2062'], limitations: ['Lifecycle fixtures are unsigned while platform identities remain unprovisioned.', 'Lifecycle evidence was produced against Craft v0.0.48 built from source (bf75807). Craft now publishes a prebuilt craft-darwin-x64.zip with every release, and no Stacks lifecycle run has re-verified a prebuilt release yet.'] },
  { platform: 'linux', architecture: 'x64', status: 'experimental', osVersions: ['Ubuntu 24.04 runner'], packageFormat: 'DEB', signing: 'pending', notarization: 'not-applicable', installLaunchEvidence: 'https://github.com/stacksjs/stacks/actions/runs/29890804159', updateRollbackEvidence: 'https://github.com/stacksjs/stacks/actions/runs/29890804159', packagingEvidence: 'https://github.com/stacksjs/protocol/blob/main/evidence/craft.json', blockingIssues: ['https://github.com/stacksjs/stacks/issues/2062'], limitations: ['The lifecycle fixture is unsigned and no package repository support policy is published.', 'Lifecycle evidence was produced against Craft v0.0.48 built from source (bf75807). Craft now publishes a prebuilt craft-linux-x64.zip with every release, and no Stacks lifecycle run has re-verified a prebuilt release yet.'] },
  { platform: 'win32', architecture: 'x64', status: 'experimental', osVersions: ['Windows Server 2025 runner'], packageFormat: 'MSI + ZIP', signing: 'pending', notarization: 'not-applicable', installLaunchEvidence: 'https://github.com/stacksjs/stacks/actions/runs/29890804159', updateRollbackEvidence: 'https://github.com/stacksjs/stacks/actions/runs/29890804159', packagingEvidence: 'https://github.com/stacksjs/protocol/blob/main/evidence/craft.json', blockingIssues: ['https://github.com/stacksjs/stacks/issues/2062'], limitations: ['The lifecycle fixture is not Authenticode-signed.', 'Lifecycle evidence was produced against Craft v0.0.48 built from source (bf75807). Craft now publishes a prebuilt craft-windows-x64.zip with every release, and no Stacks lifecycle run has re-verified a prebuilt release yet.'] },
] as const

export function desktopSupport(platform: string = process.platform, architecture: string = process.arch): DesktopSupportRow | undefined {
  return desktopSupportMatrix.find(row => row.platform === platform && row.architecture === architecture)
}

export function assertDesktopReleaseChannel(channel: 'experimental' | 'stable', platform: string = process.platform, architecture: string = process.arch): DesktopSupportRow {
  const row = desktopSupport(platform, architecture)
  if (!row) throw new Error(`Desktop target ${platform}/${architecture} is unsupported`)
  if (channel === 'stable' && (row.status !== 'stable' || row.signing !== 'enforced' || (row.platform === 'darwin' && row.notarization !== 'enforced') || !row.installLaunchEvidence || !row.updateRollbackEvidence))
    throw new Error(`Desktop target ${platform}/${architecture} cannot be released as stable; complete stacksjs/stacks#2059, #2062, and #2063 first`)
  return row
}
