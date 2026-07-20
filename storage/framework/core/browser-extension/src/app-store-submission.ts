import type {
  ExtensionConfig,
  SafariAppStoreAgeRating,
  SafariAppStoreConfig,
  SafariPlatform,
  SafariScreenshotDisplayType,
} from './types'
import type { AppStoreConnectClientOptions } from './app-store-connect'
import { createHash } from 'node:crypto'
import { basename, resolve } from 'node:path'
import { readFile, stat } from 'node:fs/promises'
import { AppStoreConnectClient } from './app-store-connect'

interface Resource<T extends Record<string, unknown>> {
  type: string
  id: string
  attributes: T
  relationships?: Record<string, { data?: { type: string, id: string } | Array<{ type: string, id: string }> | null }>
}

interface ListResponse<T extends Record<string, unknown>> {
  data: Array<Resource<T>>
  included?: Array<Resource<Record<string, unknown>>>
}

interface ResourceResponse<T extends Record<string, unknown>> {
  data: Resource<T>
}

interface AppInfoAttributes extends Record<string, unknown> {
  appStoreState: string
}

interface LocalizationAttributes extends Record<string, unknown> {
  locale: string
}

interface ScreenshotSetAttributes extends Record<string, unknown> {
  screenshotDisplayType: SafariScreenshotDisplayType
}

interface UploadOperation {
  method: string
  url: string
  length: number
  offset: number
  requestHeaders: Array<{ name: string, value: string }>
}

interface ScreenshotAttributes extends Record<string, unknown> {
  fileName: string
  fileSize: number
  sourceFileChecksum?: string
  uploadOperations?: UploadOperation[]
  assetDeliveryState?: { state?: string, errors?: Array<{ message?: string }> }
}

interface ReviewSubmissionAttributes extends Record<string, unknown> {
  platform: 'IOS' | 'MAC_OS'
  state: string
}

interface SafariStoreVersion {
  platform: SafariPlatform
  id: string
  buildId?: string
}

export interface SafariStoreSubmissionOptions {
  cwd?: string
  /** Submit the prepared versions even if config.submitForReview is false. */
  submit?: boolean
  /** Maximum time to wait for screenshots to process. @default 10 minutes */
  screenshotTimeoutMs?: number
  /** Delay between screenshot processing checks. @default 5 seconds */
  screenshotPollIntervalMs?: number
}

export interface SafariStoreSubmissionResult {
  appId: string
  versions: Array<{ platform: SafariPlatform, versionId: string, localizationId: string }>
  reviewSubmissionIds: string[]
}

export interface SubmitSafariAppStoreOptions extends AppStoreConnectClientOptions, SafariStoreSubmissionOptions {
  /** Marketing version whose prepared platform listings should be submitted. */
  version: string
  /** Platforms to submit. @default config.safariPlatforms ?? ['macos'] */
  platforms?: SafariPlatform[]
}

const frequencyFields: Array<keyof SafariAppStoreAgeRating> = [
  'alcoholTobaccoOrDrugUseOrReferences',
  'contests',
  'gamblingSimulated',
  'gunsOrOtherWeapons',
  'medicalOrTreatmentInformation',
  'profanityOrCrudeHumor',
  'sexualContentGraphicAndNudity',
  'sexualContentOrNudity',
  'horrorOrFearThemes',
  'matureOrSuggestiveThemes',
  'violenceCartoonOrFantasy',
  'violenceRealisticProlongedGraphicOrSadistic',
  'violenceRealistic',
]

const booleanFields: Array<keyof SafariAppStoreAgeRating> = [
  'advertising',
  'gambling',
  'healthOrWellnessTopics',
  'lootBox',
  'messagingAndChat',
  'parentalControls',
  'ageAssurance',
  'socialMedia',
  'socialMediaAgeRestricted',
  'unrestrictedWebAccess',
  'userGeneratedContent',
]

const editableVersionStates = new Set(['PREPARE_FOR_SUBMISSION', 'DEVELOPER_REJECTED', 'REJECTED', 'METADATA_REJECTED'])

function ageRatingAttributes(config: SafariAppStoreAgeRating = {}): Record<string, boolean | string> {
  const attributes: Record<string, boolean | string> = {
    ageRatingOverrideV2: 'NONE',
    koreaAgeRatingOverride: 'NONE',
  }
  for (const field of frequencyFields)
    attributes[field] = config[field] ?? 'NONE'
  for (const field of booleanFields)
    attributes[field] = config[field] ?? false
  return attributes
}

function applePlatform(platform: SafariPlatform): 'IOS' | 'MAC_OS' {
  return platform === 'ios' ? 'IOS' : 'MAC_OS'
}

function displayTypesForPlatform(platform: SafariPlatform): SafariScreenshotDisplayType[] {
  return platform === 'macos' ? ['APP_DESKTOP'] : ['APP_IPHONE_67', 'APP_IPAD_PRO_3GEN_129']
}

async function updateAppInfo(client: AppStoreConnectClient, appId: string, config: SafariAppStoreConfig): Promise<string> {
  await client.request(`/apps/${appId}`, {
    method: 'PATCH',
    body: JSON.stringify({
      data: {
        type: 'apps',
        id: appId,
        attributes: { contentRightsDeclaration: config.contentRightsDeclaration },
      },
    }),
  })
  const infos = await client.request<ListResponse<AppInfoAttributes>>(`/apps/${appId}/appInfos?limit=10`)
  const info = infos.data.find(item => item.attributes.appStoreState === 'PREPARE_FOR_SUBMISSION') ?? infos.data[0]
  if (!info)
    throw new Error('[browser-extension] App Store Connect has no editable app information resource')

  await client.request(`/appInfos/${info.id}`, {
    method: 'PATCH',
    body: JSON.stringify({
      data: {
        type: 'appInfos',
        id: info.id,
        relationships: {
          primaryCategory: { data: { type: 'appCategories', id: config.primaryCategory } },
        },
      },
    }),
  })

  const localizations = await client.request<ListResponse<LocalizationAttributes>>(`/appInfos/${info.id}/appInfoLocalizations?limit=200`)
  const locale = config.locale ?? 'en-US'
  const localization = localizations.data.find(item => item.attributes.locale === locale)
  if (!localization)
    throw new Error(`[browser-extension] App Store Connect app information is missing the ${locale} localization`)
  await client.request(`/appInfoLocalizations/${localization.id}`, {
    method: 'PATCH',
    body: JSON.stringify({
      data: {
        type: 'appInfoLocalizations',
        id: localization.id,
        attributes: {
          subtitle: config.subtitle,
          privacyPolicyUrl: config.privacyPolicyUrl,
        },
      },
    }),
  })

  await client.request(`/ageRatingDeclarations/${info.id}`, {
    method: 'PATCH',
    body: JSON.stringify({
      data: {
        type: 'ageRatingDeclarations',
        id: info.id,
        attributes: ageRatingAttributes(config.ageRating),
      },
    }),
  })
  return info.id
}

async function ensurePrice(client: AppStoreConnectClient, appId: string, config: SafariAppStoreConfig): Promise<void> {
  const existing = await client.request<ListResponse<Record<string, unknown>>>(`/appPriceSchedules/${appId}/manualPrices?limit=200`)
  if (existing.data.length)
    return
  const baseTerritory = config.baseTerritory ?? 'USA'
  const pricePoints = await client.request<ListResponse<{ customerPrice: string }>>(`/apps/${appId}/appPricePoints?filter[territory]=${encodeURIComponent(baseTerritory)}&limit=200`)
  const requestedPrice = Number(config.price)
  const pricePoint = pricePoints.data.find(item => Number(item.attributes.customerPrice) === requestedPrice)
  if (!pricePoint)
    throw new Error(`[browser-extension] App Store price ${config.price} is unavailable in ${baseTerritory}`)
  const localId = '${price}'
  await client.request('/appPriceSchedules', {
    method: 'POST',
    body: JSON.stringify({
      data: {
        type: 'appPriceSchedules',
        relationships: {
          app: { data: { type: 'apps', id: appId } },
          baseTerritory: { data: { type: 'territories', id: baseTerritory } },
          manualPrices: { data: [{ type: 'appPrices', id: localId }] },
        },
      },
      included: [{
        type: 'appPrices',
        id: localId,
        attributes: { startDate: null, endDate: null },
        relationships: { appPricePoint: { data: { type: 'appPricePoints', id: pricePoint.id } } },
      }],
    }),
  })
}

async function ensureAvailability(client: AppStoreConnectClient, appId: string, availableInNewTerritories = true): Promise<void> {
  try {
    const existing = await client.request<ResourceResponse<{ availableInNewTerritories: boolean }>>(`/apps/${appId}/appAvailabilityV2`)
    if (existing.data.attributes.availableInNewTerritories === availableInNewTerritories)
      return
    // Apple currently exposes creation and territory updates, but no direct
    // app-availability PATCH. Keep existing territory choices intact.
    return
  }
  catch (error) {
    if (!(error instanceof Error) || !error.message.includes('(404)'))
      throw error
  }

  const territories = await client.request<ListResponse<Record<string, unknown>>>('/territories?limit=200')
  const included = territories.data.map((territory, index) => {
    const id = `\${territory-${index}}`
    return {
      type: 'territoryAvailabilities',
      id,
      attributes: { available: true },
      relationships: { territory: { data: { type: 'territories', id: territory.id } } },
    }
  })
  await client.request('/v2/appAvailabilities', {
    method: 'POST',
    body: JSON.stringify({
      data: {
        type: 'appAvailabilities',
        attributes: { availableInNewTerritories },
        relationships: {
          app: { data: { type: 'apps', id: appId } },
          territoryAvailabilities: {
            data: included.map(item => ({ type: item.type, id: item.id })),
          },
        },
      },
      included,
    }),
  })
}

async function ensureVersionLocalization(
  client: AppStoreConnectClient,
  versionId: string,
  config: SafariAppStoreConfig,
): Promise<string> {
  const locale = config.locale ?? 'en-US'
  const localizations = await client.request<ListResponse<LocalizationAttributes>>(`/appStoreVersions/${versionId}/appStoreVersionLocalizations?limit=200`)
  let localization = localizations.data.find(item => item.attributes.locale === locale)
  if (!localization) {
    const created = await client.request<ResourceResponse<LocalizationAttributes>>('/appStoreVersionLocalizations', {
      method: 'POST',
      body: JSON.stringify({
        data: {
          type: 'appStoreVersionLocalizations',
          attributes: { locale },
          relationships: { appStoreVersion: { data: { type: 'appStoreVersions', id: versionId } } },
        },
      }),
    })
    localization = created.data
  }

  await client.request(`/appStoreVersionLocalizations/${localization.id}`, {
    method: 'PATCH',
    body: JSON.stringify({
      data: {
        type: 'appStoreVersionLocalizations',
        id: localization.id,
        attributes: {
          description: config.description,
          keywords: config.keywords,
          supportUrl: config.supportUrl,
          ...(config.marketingUrl ? { marketingUrl: config.marketingUrl } : {}),
          ...(config.promotionalText ? { promotionalText: config.promotionalText } : {}),
          ...(config.whatsNew ? { whatsNew: config.whatsNew } : {}),
        },
      },
    }),
  })
  return localization.id
}

async function ensureReviewDetail(client: AppStoreConnectClient, versionId: string, config: SafariAppStoreConfig): Promise<void> {
  const response = await client.request<{ data: Resource<Record<string, unknown>> | null }>(`/appStoreVersions/${versionId}/appStoreReviewDetail`)
  const attributes = {
    contactFirstName: config.reviewContact.firstName,
    contactLastName: config.reviewContact.lastName,
    contactPhone: config.reviewContact.phone,
    contactEmail: config.reviewContact.email,
    demoAccountRequired: false,
    ...(config.reviewContact.notes ? { notes: config.reviewContact.notes } : {}),
  }
  if (response.data) {
    await client.request(`/appStoreReviewDetails/${response.data.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ data: { type: 'appStoreReviewDetails', id: response.data.id, attributes } }),
    })
    return
  }
  await client.request('/appStoreReviewDetails', {
    method: 'POST',
    body: JSON.stringify({
      data: {
        type: 'appStoreReviewDetails',
        attributes,
        relationships: { appStoreVersion: { data: { type: 'appStoreVersions', id: versionId } } },
      },
    }),
  })
}

async function ensureScreenshotSet(client: AppStoreConnectClient, localizationId: string, displayType: SafariScreenshotDisplayType): Promise<string> {
  const response = await client.request<ListResponse<ScreenshotSetAttributes>>(`/appStoreVersionLocalizations/${localizationId}/appScreenshotSets?limit=200`)
  const existing = response.data.find(item => item.attributes.screenshotDisplayType === displayType)
  if (existing)
    return existing.id
  const created = await client.request<ResourceResponse<ScreenshotSetAttributes>>('/appScreenshotSets', {
    method: 'POST',
    body: JSON.stringify({
      data: {
        type: 'appScreenshotSets',
        attributes: { screenshotDisplayType: displayType },
        relationships: {
          appStoreVersionLocalization: { data: { type: 'appStoreVersionLocalizations', id: localizationId } },
        },
      },
    }),
  })
  return created.data.id
}

async function waitForScreenshot(
  client: AppStoreConnectClient,
  id: string,
  timeoutMs: number,
  pollIntervalMs: number,
): Promise<void> {
  const deadline = Date.now() + timeoutMs
  while (true) {
    const response = await client.request<ResourceResponse<ScreenshotAttributes>>(`/appScreenshots/${id}`)
    const state = response.data.attributes.assetDeliveryState?.state
    if (state === 'COMPLETE')
      return
    if (state === 'FAILED') {
      const detail = response.data.attributes.assetDeliveryState?.errors?.map(error => error.message).filter(Boolean).join('; ')
      throw new Error(`[browser-extension] App Store screenshot processing failed${detail ? `: ${detail}` : ''}`)
    }
    if (Date.now() >= deadline)
      throw new Error(`[browser-extension] timed out waiting for App Store screenshot ${response.data.attributes.fileName}`)
    await Bun.sleep(pollIntervalMs)
  }
}

async function uploadScreenshot(
  client: AppStoreConnectClient,
  setId: string,
  path: string,
  timeoutMs: number,
  pollIntervalMs: number,
): Promise<string> {
  const bytes = await readFile(path)
  const file = basename(path)
  const checksum = createHash('md5').update(bytes).digest('hex')
  const reserved = await client.request<ResourceResponse<ScreenshotAttributes>>('/appScreenshots', {
    method: 'POST',
    body: JSON.stringify({
      data: {
        type: 'appScreenshots',
        attributes: { fileName: file, fileSize: bytes.byteLength },
        relationships: { appScreenshotSet: { data: { type: 'appScreenshotSets', id: setId } } },
      },
    }),
  })
  for (const operation of reserved.data.attributes.uploadOperations ?? []) {
    const body = bytes.subarray(operation.offset, operation.offset + operation.length)
    await client.upload(operation.url, {
      method: operation.method,
      headers: Object.fromEntries(operation.requestHeaders.map(header => [header.name, header.value])),
      body,
    })
  }
  await client.request(`/appScreenshots/${reserved.data.id}`, {
    method: 'PATCH',
    body: JSON.stringify({
      data: {
        type: 'appScreenshots',
        id: reserved.data.id,
        attributes: { uploaded: true, sourceFileChecksum: checksum },
      },
    }),
  })
  await waitForScreenshot(client, reserved.data.id, timeoutMs, pollIntervalMs)
  return reserved.data.id
}

async function syncScreenshotSet(
  client: AppStoreConnectClient,
  setId: string,
  paths: string[],
  cwd: string,
  timeoutMs: number,
  pollIntervalMs: number,
): Promise<void> {
  if (paths.length > 10)
    throw new Error('[browser-extension] App Store screenshot sets accept at most 10 images')
  const files = await Promise.all(paths.map(async (path) => {
    const absolute = resolve(cwd, path)
    await stat(absolute)
    const bytes = await readFile(absolute)
    return { absolute, name: basename(absolute), checksum: createHash('md5').update(bytes).digest('hex') }
  }))
  const existing = await client.request<ListResponse<ScreenshotAttributes>>(`/appScreenshotSets/${setId}/appScreenshots?limit=200`)
  for (const screenshot of existing.data) {
    const desired = files.find(file => file.name === screenshot.attributes.fileName)
    if (!desired || desired.checksum !== screenshot.attributes.sourceFileChecksum) {
      await client.request(`/appScreenshots/${screenshot.id}`, { method: 'DELETE' })
    }
  }
  for (const file of files) {
    const current = existing.data.find(screenshot => screenshot.attributes.fileName === file.name && screenshot.attributes.sourceFileChecksum === file.checksum)
    if (!current)
      await uploadScreenshot(client, setId, file.absolute, timeoutMs, pollIntervalMs)
  }
}

async function updateVersion(client: AppStoreConnectClient, version: SafariStoreVersion, config: SafariAppStoreConfig): Promise<void> {
  await client.request(`/appStoreVersions/${version.id}`, {
    method: 'PATCH',
    body: JSON.stringify({
      data: {
        type: 'appStoreVersions',
        id: version.id,
        attributes: {
          copyright: config.copyright,
          releaseType: config.releaseType ?? 'AFTER_APPROVAL',
          usesIdfa: config.usesIdfa ?? false,
        },
      },
    }),
  })
  if (version.buildId) {
    const encryption = config.usesNonExemptEncryption ?? false
    const build = await client.request<ResourceResponse<{ usesNonExemptEncryption?: boolean }>>(`/builds/${version.buildId}?fields[builds]=usesNonExemptEncryption`)
    if (build.data.attributes.usesNonExemptEncryption === undefined || build.data.attributes.usesNonExemptEncryption === null) {
      await client.request(`/builds/${version.buildId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          data: {
            type: 'builds',
            id: version.buildId,
            attributes: { usesNonExemptEncryption: encryption },
          },
        }),
      })
    }
  }
}

async function submitVersions(client: AppStoreConnectClient, appId: string, versions: SafariStoreVersion[]): Promise<string[]> {
  const existing = await client.request<ListResponse<ReviewSubmissionAttributes>>(`/apps/${appId}/reviewSubmissions?limit=200`)
  const ids: string[] = []
  for (const version of versions) {
    const platform = applePlatform(version.platform)
    const platformSubmissions = existing.data.filter(item => item.attributes.platform === platform)
    let submission: Resource<ReviewSubmissionAttributes> | undefined
    for (const candidate of platformSubmissions) {
      const items = await client.request<ListResponse<Record<string, unknown>>>(`/reviewSubmissions/${candidate.id}/items?include=appStoreVersion&limit=200`)
      const alreadyAdded = (items.included ?? []).some(item => item.type === 'appStoreVersions' && item.id === version.id)
      if (!alreadyAdded)
        continue
      submission = candidate
      if (candidate.attributes.state !== 'READY_FOR_REVIEW') {
        ids.push(candidate.id)
        break
      }
    }
    if (submission && submission.attributes.state !== 'READY_FOR_REVIEW')
      continue
    submission ??= platformSubmissions.find(item => item.attributes.state === 'READY_FOR_REVIEW')
    if (!submission) {
      submission = (await client.request<ResourceResponse<ReviewSubmissionAttributes>>('/reviewSubmissions', {
        method: 'POST',
        body: JSON.stringify({
          data: {
            type: 'reviewSubmissions',
            attributes: { platform },
            relationships: { app: { data: { type: 'apps', id: appId } } },
          },
        }),
      })).data
    }
    const items = await client.request<ListResponse<Record<string, unknown>>>(`/reviewSubmissions/${submission.id}/items?include=appStoreVersion&limit=200`)
    const alreadyAdded = (items.included ?? []).some(item => item.type === 'appStoreVersions' && item.id === version.id)
    if (!alreadyAdded) {
      await client.request('/reviewSubmissionItems', {
        method: 'POST',
        body: JSON.stringify({
          data: {
            type: 'reviewSubmissionItems',
            relationships: {
              reviewSubmission: { data: { type: 'reviewSubmissions', id: submission.id } },
              appStoreVersion: { data: { type: 'appStoreVersions', id: version.id } },
            },
          },
        }),
      })
    }
    await client.request(`/reviewSubmissions/${submission.id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        data: { type: 'reviewSubmissions', id: submission.id, attributes: { submitted: true } },
      }),
    })
    ids.push(submission.id)
  }
  return ids
}

/** Synchronize a Safari listing and optionally submit all configured platforms to App Review. */
export async function prepareSafariAppStoreSubmission(
  client: AppStoreConnectClient,
  config: ExtensionConfig,
  appId: string,
  versions: SafariStoreVersion[],
  options: SafariStoreSubmissionOptions = {},
): Promise<SafariStoreSubmissionResult> {
  const store = config.safariAppStore
  if (!store)
    throw new Error('[browser-extension] Safari App Store automation needs safariAppStore in config/extension.ts')
  const cwd = options.cwd ?? process.cwd()
  const timeoutMs = options.screenshotTimeoutMs ?? 10 * 60_000
  const pollIntervalMs = options.screenshotPollIntervalMs ?? 5_000

  await updateAppInfo(client, appId, store)
  await ensurePrice(client, appId, store)
  await ensureAvailability(client, appId, store.availableInNewTerritories ?? true)

  const results: SafariStoreSubmissionResult['versions'] = []
  for (const version of versions) {
    await updateVersion(client, version, store)
    const localizationId = await ensureVersionLocalization(client, version.id, store)
    await ensureReviewDetail(client, version.id, store)
    for (const displayType of displayTypesForPlatform(version.platform)) {
      const paths = store.screenshots[displayType] ?? []
      if (!paths.length)
        continue
      const setId = await ensureScreenshotSet(client, localizationId, displayType)
      await syncScreenshotSet(client, setId, paths, cwd, timeoutMs, pollIntervalMs)
    }
    results.push({ platform: version.platform, versionId: version.id, localizationId })
  }

  const shouldSubmit = options.submit ?? store.submitForReview ?? false
  return {
    appId,
    versions: results,
    reviewSubmissionIds: shouldSubmit ? await submitVersions(client, appId, versions) : [],
  }
}

/** Prepare and submit an already-uploaded Safari version without rebuilding its binary. */
export async function submitSafariAppStore(
  config: ExtensionConfig,
  options: SubmitSafariAppStoreOptions,
): Promise<SafariStoreSubmissionResult> {
  if (!config.safariBundleId)
    throw new Error('[browser-extension] Safari App Store submission needs safariBundleId in config/extension.ts')
  const client = new AppStoreConnectClient(options)
  const app = await client.findApp(config.safariBundleId)
  if (!app)
    throw new Error('[browser-extension] the App Store Connect app record is missing')
  const selectedPlatforms = options.platforms ?? config.safariPlatforms ?? ['macos']
  const availableVersions = await client.listAppStoreVersions(app.id)
  const versions: SafariStoreVersion[] = []
  const versionStates: string[] = []
  for (const platform of selectedPlatforms) {
    const match = availableVersions.find(item => item.attributes.platform === applePlatform(platform) && item.attributes.versionString === options.version)
    if (!match)
      throw new Error(`[browser-extension] Safari ${platform} App Store version ${options.version} does not exist`)
    const build = await client.request<{ data: Resource<Record<string, unknown>> | null }>(`/appStoreVersions/${match.id}/build`)
    versions.push({ platform, id: match.id, buildId: build.data?.id })
    versionStates.push(match.attributes.appStoreState)
  }
  const shouldSubmit = options.submit ?? config.safariAppStore?.submitForReview ?? false
  if (shouldSubmit && versionStates.every(state => !editableVersionStates.has(state))) {
    const preparedVersions = await Promise.all(versions.map(async (version) => {
      const localizations = await client.request<ListResponse<LocalizationAttributes>>(`/appStoreVersions/${version.id}/appStoreVersionLocalizations?limit=200`)
      return { platform: version.platform, versionId: version.id, localizationId: localizations.data[0]?.id ?? '' }
    }))
    return {
      appId: app.id,
      versions: preparedVersions,
      reviewSubmissionIds: await submitVersions(client, app.id, versions),
    }
  }
  return await prepareSafariAppStoreSubmission(client, config, app.id, versions, options)
}
