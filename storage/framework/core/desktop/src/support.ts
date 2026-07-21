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
  limitations: string[]
}

export const desktopSupportMatrix: readonly DesktopSupportRow[] = [
  { platform: 'darwin', architecture: 'arm64', status: 'experimental', osVersions: [], packageFormat: 'unpackaged bundle', signing: 'pending', notarization: 'pending', installLaunchEvidence: null, updateRollbackEvidence: null, limitations: ['No retained native install/launch matrix.', 'Developer ID signing and notarization are not configured.'] },
  { platform: 'darwin', architecture: 'x64', status: 'experimental', osVersions: [], packageFormat: 'unpackaged bundle', signing: 'pending', notarization: 'pending', installLaunchEvidence: null, updateRollbackEvidence: null, limitations: ['No retained native install/launch matrix.', 'Developer ID signing and notarization are not configured.'] },
  { platform: 'linux', architecture: 'x64', status: 'experimental', osVersions: [], packageFormat: 'unpackaged bundle', signing: 'pending', notarization: 'not-applicable', installLaunchEvidence: null, updateRollbackEvidence: null, limitations: ['No distribution/version support commitment.', 'Package/repository signing is not configured.'] },
  { platform: 'win32', architecture: 'x64', status: 'experimental', osVersions: [], packageFormat: 'unpackaged bundle', signing: 'pending', notarization: 'not-applicable', installLaunchEvidence: null, updateRollbackEvidence: null, limitations: ['No retained native install/launch matrix.', 'Authenticode signing and installer verification are not configured.'] },
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
