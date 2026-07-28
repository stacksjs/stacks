import type { ExtensionConfig, SafariPlatform } from './types'
import type {
  AppStoreConnectClientOptions,
  AppStoreVersionPlatform,
  AppStoreVersionResult,
  BundleIdPlatform,
} from 'ts-pantry'
import {
  AppStoreConnectClient,
  ensureAppStoreVersions,
  provisionMacApp,
  waitForAppStoreBuilds,
} from 'ts-pantry'

export {
  AppStoreConnectClient,
  provisionMacApp,
}
export { appStoreConnectToken } from 'ts-pantry'
export type {
  AppAttributes,
  AppStoreBuildAttachmentResult,
  AppStoreBuildResult,
  AppStoreConnectAuth,
  AppStoreConnectClientOptions,
  AppStoreConnectResource,
  AppStoreVersionAttributes,
  AppStoreVersionPlatform,
  BuildAttributes,
  BundleIdAttributes,
  BundleIdCapabilityAttributes,
  BundleIdPlatform,
  CertificateAttributes,
  MacAppProvisionOptions,
  MacAppProvisionResult,
  MacDistributionCertificateType,
  PreReleaseVersionAttributes,
  ProfileAttributes,
} from 'ts-pantry'

function appStorePlatform(platform: SafariPlatform): AppStoreVersionPlatform {
  return platform === 'ios' ? 'IOS' : 'MAC_OS'
}

export interface SafariAppStoreVersionResult {
  platform: SafariPlatform
  version: string
  created: boolean
  updated: boolean
  id: string
  status?: 'ready' | 'deferred' | 'published'
  appStoreState?: string
  reason?: string
}

export interface SafariBuildAttachmentResult {
  platform: SafariPlatform
  versionId: string
  buildId: string
  buildNumber: string
}

export interface AttachSafariBuildsOptions {
  /** Maximum time to wait for App Store Connect processing. @default 20 minutes */
  timeoutMs?: number
  /** Delay between App Store Connect processing checks. @default 15 seconds */
  pollIntervalMs?: number
}

/** Wait for the uploaded binaries to process, then select them for their App Store versions. */
export async function attachSafariBuilds(
  client: AppStoreConnectClient,
  appId: string,
  versions: SafariAppStoreVersionResult[],
  buildNumber: string,
  options: AttachSafariBuildsOptions = {},
): Promise<SafariBuildAttachmentResult[]> {
  const pantryVersions = versions.map(version => ({
    platform: appStorePlatform(version.platform),
    version: version.version,
    id: version.id,
  }))
  const attachments = await waitForAppStoreBuilds(client, appId, pantryVersions, buildNumber, options)
  return attachments.map(attachment => ({
    platform: attachment.platform === 'IOS' ? 'ios' : 'macos',
    versionId: attachment.versionId,
    buildId: attachment.buildId,
    buildNumber: attachment.buildNumber,
  }))
}

async function ensureConfiguredAppStoreVersions(client: AppStoreConnectClient, appId: string, platforms: SafariPlatform[], version: string): Promise<SafariAppStoreVersionResult[]> {
  const results = await ensureAppStoreVersions(
    client,
    appId,
    platforms.map(platform => ({ platform: appStorePlatform(platform), version })),
  )
  return results.map((result: AppStoreVersionResult) => {
    const platform = result.platform === 'IOS' ? 'ios' : 'macos'
    return {
      ...result,
      platform,
      ...(result.reason ? { reason: result.reason.replace(`${result.platform} version`, `Safari ${platform} version`) } : {}),
    }
  })
}

export interface SafariProvisionOptions extends AppStoreConnectClientOptions {
  /** Only report missing resources; do not register Bundle IDs. @default false */
  checkOnly?: boolean
  /** Bundle ID platform used when registering. @default MAC_OS */
  platform?: BundleIdPlatform
  /** Create or align editable App Store versions for the selected platforms. */
  version?: string
  /** App Store platforms to provision. @default config.safariPlatforms ?? ['macos'] */
  platforms?: SafariPlatform[]
}

export interface SafariProvisionResult {
  container: { identifier: string, exists: boolean, created: boolean }
  extension: { identifier: string, exists: boolean, created: boolean }
  appRecord: { exists: boolean, id?: string }
  appStoreVersions: SafariAppStoreVersionResult[]
}

/**
 * Register the explicit container and extension Bundle IDs required by a
 * Safari Web Extension, then check for the manually-created App Store Connect
 * app record. Apple does not expose an official API for creating that record.
 */
export async function provisionSafariApp(config: ExtensionConfig, options: SafariProvisionOptions = {}): Promise<SafariProvisionResult> {
  if (!config.safariBundleId)
    throw new Error('[browser-extension] Safari provisioning needs safariBundleId in config/extension.ts')

  const client = new AppStoreConnectClient(options)
  const identifier = config.safariBundleId
  const extensionIdentifier = `${identifier}.Extension`
  const platforms = options.platforms ?? config.safariPlatforms ?? ['macos']
  const bundleIdPlatform = options.platform ?? (platforms.includes('ios') ? 'UNIVERSAL' : 'MAC_OS')
  const bundleOptions = { checkOnly: options.checkOnly, platform: bundleIdPlatform }
  const container = await client.ensureBundleId(identifier, config.name, bundleOptions)
  const extension = await client.ensureBundleId(extensionIdentifier, `${config.name} Safari Extension`, bundleOptions)
  const app = await client.findApp(identifier)
  const appStoreVersions = app && options.version && !options.checkOnly
    ? await ensureConfiguredAppStoreVersions(client, app.id, platforms, options.version)
    : []

  return {
    container: { identifier, exists: Boolean(container.bundleId), created: container.created },
    extension: { identifier: extensionIdentifier, exists: Boolean(extension.bundleId), created: extension.created },
    appRecord: { exists: Boolean(app), id: app?.id },
    appStoreVersions,
  }
}
