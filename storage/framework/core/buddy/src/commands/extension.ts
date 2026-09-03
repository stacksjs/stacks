import type { CLI } from '@stacksjs/types'
import process from 'node:process'
import { log } from '@stacksjs/cli'

interface ExtensionOptions {
  target?: 'chrome' | 'firefox' | 'safari'
  version?: string
}

type SafariPlatform = 'macos' | 'ios'

function parseSafariPlatforms(platform?: string): SafariPlatform[] | undefined {
  if (!platform)
    return undefined
  if (platform === 'all')
    return ['macos', 'ios']
  if (platform === 'macos' || platform === 'ios')
    return [platform]
  throw new Error(`Invalid Safari platform ${platform}; use macos, ios, or all`)
}

/**
 * Rebuild the App Store screenshot set from `config/images.ts`.
 *
 * A listing's screenshots are the part most likely to be stale: they are built
 * from the product, and nothing fails when they fall behind it. Rebuilding on
 * the way to an upload keeps the set that ships describing the build that
 * ships. No-ops when the project declares none.
 *
 * Never fatal. What gets uploaded is the committed set the config points at;
 * regenerating is a freshness pass over it, and a publish runner has no reason
 * to hold captures of a product it did not launch. Letting a missing capture
 * throw took down the whole Safari publish — and with it the Firefox and
 * GitHub Release steps waiting behind it — for a listing whose screenshots were
 * sitting in the repository, correct.
 */
async function refreshAppStoreScreenshots(): Promise<void> {
  try {
    const { generateProjectImages } = await import('@stacksjs/actions')
    await generateProjectImages({ only: ['app-store'] })
  }
  catch (error) {
    log.warn(`[extension:publish] using the committed screenshots - could not regenerate: ${(error as Error).message}`)
  }
}

/**
 * Push the declared listing screenshots to AMO after a submission.
 *
 * AMO is the only one of the three stores whose API will take these on the way
 * past. Never fatal: the add-on is already submitted by this point, and a
 * listing with yesterday's screenshots beats a publish reported as failed.
 */
async function syncFirefoxListing(
  config: { firefoxAddons?: { screenshots?: unknown[] } },
  credentials: { issuer?: string, secret?: string },
): Promise<void> {
  if (!config.firefoxAddons?.screenshots?.length)
    return

  try {
    const { syncFirefoxPreviews } = await import('@stacksjs/browser-extension')
    const previews = await syncFirefoxPreviews(config as never, credentials)
    if (previews.unchanged)
      log.info('Firefox listing screenshots already match')
    else
      log.success(`Synced ${previews.uploaded.length} Firefox listing screenshot(s), removed ${previews.removed.length}`)
  }
  catch (error) {
    log.warn(`[extension:publish] Firefox listing screenshots not synced: ${(error as Error).message}`)
  }
}

/**
 * `buddy extension:*` — build & package MV3 browser extensions from the
 * project's `config/extension.ts` (see @stacksjs/browser-extension). Zero
 * per-project build scripts: the framework owns the manifest, bundling, and
 * packaging.
 */
export function extension(buddy: CLI): void {
  const load = async () => {
    const { loadExtensionConfig } = await import('@stacksjs/browser-extension')
    const config = await loadExtensionConfig(process.cwd())
    if (!config) {
      await log.error('No extension config found. Create `config/extension.ts` exporting `defineExtension({ … })`.')
      process.exit(1)
    }
    // Version: explicit flag, else the project's package.json.
    const pkg = await Bun.file(`${process.cwd()}/package.json`).json().catch(() => ({}))
    return { config, version: pkg.version ?? '0.0.0' }
  }

  buddy
    .command('extension:build', 'Build the browser extension (Chrome + Firefox + Safari) from config/extension.ts')
    .option('--target <target>', 'Build a single target (chrome | firefox | safari); omit to build all')
    .option('--version <version>', 'Override the extension version (defaults to package.json)')
    .action(async (options: ExtensionOptions) => {
      const { buildExtension, buildAllTargets } = await import('@stacksjs/browser-extension')
      const { config, version } = await load()
      const v = options.version ?? version
      if (options.target) {
        const { outdir } = await buildExtension(config, { target: options.target, version: v })
        log.success(`Built ${config.name} ${v} (${options.target}) → ${outdir}`)
      }
      else {
        await buildAllTargets(config, { version: v })
        log.success(`Built ${config.name} ${v} for ${(config.targets ?? ['chrome', 'firefox']).join(', ')}`)
      }
    })

  buddy
    .command('extension:init', 'Scaffold a Chrome, Firefox, or Safari extension, including the Safari Xcode app')
    .option('--name <name>', 'Extension display name')
    .option('--target <target>', 'Scaffold chrome, firefox, safari, or all (default all)')
    .option('--bundle-id <id>', 'Safari container bundle identifier')
    .option('--team-id <id>', 'Apple Developer team used for Safari signing')
    .option('--platform <platform>', 'Safari platform: macos, ios, or all (default all)')
    .option('--force', 'Overwrite existing starter and Safari scaffold files')
    .action(async (options: { name?: string, target?: string, bundleId?: string, teamId?: string, platform?: string, force?: boolean }) => {
      const target = options.target ?? 'all'
      if (!['chrome', 'firefox', 'safari', 'all'].includes(target))
        throw new Error(`Invalid extension target ${target}; use chrome, firefox, safari, or all`)
      const { scaffoldExtensionProject } = await import('@stacksjs/browser-extension')
      const result = await scaffoldExtensionProject({
        name: options.name,
        target: target as 'chrome' | 'firefox' | 'safari' | 'all',
        bundleId: options.bundleId,
        teamId: options.teamId,
        platforms: parseSafariPlatforms(options.platform) ?? ['macos', 'ios'],
        force: Boolean(options.force),
      })
      for (const file of result.written)
        log.success(`created ${file}`)
      for (const file of result.skipped)
        log.info(`skip (exists): ${file}`)
      if (result.safari)
        log.success(`Scaffolded the Safari container app → ${result.safari.dir}`)
      log.info('Next: add icons under public/icons, then run `buddy extension:build`.')
    })

  buddy
    .command('extension:package', 'Build + zip the browser extension into store-ready archives')
    .option('--target <target>', 'Package a single target (chrome | firefox | safari); omit to package all')
    .option('--version <version>', 'Override the extension version (defaults to package.json)')
    .action(async (options: ExtensionOptions) => {
      const { packageExtension } = await import('@stacksjs/browser-extension')
      const { config, version } = await load()
      const v = options.version ?? version
      const targets = options.target ? [options.target] : (config.targets ?? ['chrome', 'firefox'])
      for (const target of targets) {
        const out = await packageExtension(config, { target, version: v })
        log.success(`Packaged ${config.name} (${target}) → ${out}`)
      }
    })

  buddy
    .command('extension:publish', 'Publish to every store this project is set up for - the release-tag entry point')
    .option('--version <version>', 'Override the extension version (defaults to package.json)')
    .option('--targets <targets>', 'Comma-separated subset of chrome,firefox,safari')
    .option('--dry-run', 'Report the publish plan without uploading anything')
    .action(async (options: { version?: string, targets?: string, dryRun?: boolean }) => {
      const {
        formatPublishPlan,
        planExtensionPublish,
        publishChromeExtension,
        publishFirefoxExtension,
        publishSafariApp,
      } = await import('@stacksjs/browser-extension')
      const { config, version } = await load()

      const requested = options.targets
        ?.split(',')
        .map(value => value.trim())
        .filter(Boolean) as ('chrome' | 'firefox' | 'safari')[] | undefined
      const plan = planExtensionPublish(config, process.env, requested?.length ? requested : undefined)
      log.info(`Extension publish plan for v${options.version ?? version}:\n${formatPublishPlan(plan)}`)

      const publishing = plan.filter(decision => decision.publish)
      if (options.dryRun || !publishing.length) {
        if (!publishing.length)
          log.warn('No store is both configured and credentialed, so nothing was published.')
        return
      }

      // Every credentialed store is attempted before anything is reported as
      // failed. One store's outage is not a reason to withhold the release from
      // the others, and a partial publish that is *named* can be retried per
      // store — whereas aborting at the first failure leaves it ambiguous which
      // stores actually received the build.
      const failures: string[] = []
      for (const { target } of publishing) {
        try {
          if (target === 'chrome') {
            const result = await publishChromeExtension(config, { version: options.version ?? version, blockOnWarnings: true })
            if (result.deferred)
              log.warn(`${result.deferred.reason}. Version ${options.version ?? version} remains queued for the next automated retry.`)
            else if (result.alreadyPublished)
              log.success(result.alreadyPublished.reason)
            else
              log.success(`Submitted Chrome Web Store item ${result.publish?.itemId ?? ''}: ${result.publish?.state ?? 'uploaded'}`)
          }
          else if (target === 'firefox') {
            const result = await publishFirefoxExtension(config, { version: options.version ?? version })
            log.success(`Submitted Firefox extension (${result.channel}) → ${result.artifactsDir}`)
            await syncFirefoxListing(config, {})
          }
          else {
            await refreshAppStoreScreenshots()
            await publishSafariApp(config, { version: options.version ?? version })
            log.success('Uploaded Safari app to App Store Connect')
          }
        }
        catch (error) {
          failures.push(`${target}: ${(error as Error).message}`)
          log.error(`[extension:publish] ${target} failed: ${(error as Error).message}`)
        }
      }

      // A store that is set up and still could not publish is a real failure —
      // exit non-zero so the release job goes red rather than quietly not
      // reaching users.
      if (failures.length) {
        await log.error(`Failed to publish ${failures.length} of ${publishing.length} store(s):\n  ${failures.join('\n  ')}`)
        process.exit(1)
      }
    })

  buddy
    .command('extension:chrome:status', 'Fetch the Chrome Web Store item status')
    .option('--service-account-path <path>', 'Google service-account JSON key path')
    .option('--access-token <token>', 'Short-lived Chrome Web Store OAuth access token')
    .action(async (options: { serviceAccountPath?: string, accessToken?: string }) => {
      const { ChromeWebStoreClient } = await import('@stacksjs/browser-extension')
      const { config } = await load()
      if (!config.chromeWebStore)
        throw new Error('Chrome status needs chromeWebStore.publisherId and chromeWebStore.itemId in config/extension.ts')
      const status = await new ChromeWebStoreClient(options).fetchStatus(config.chromeWebStore)
      log.info(`Chrome Web Store item ${status.itemId}`)
      log.info(`published: ${status.publishedItemRevisionStatus?.state ?? 'none'}`)
      log.info(`submitted: ${status.submittedItemRevisionStatus?.state ?? 'none'}`)
      if (status.warned)
        log.warn('Chrome has warned this item for a policy violation.')
      if (status.takenDown)
        log.error('Chrome has taken this item down for a policy violation.')
    })

  buddy
    .command('extension:chrome:publish', 'Build, upload, and submit the Chrome extension through Web Store API v2')
    .option('--version <version>', 'Override the extension version (defaults to package.json)')
    .option('--service-account-path <path>', 'Google service-account JSON key path')
    .option('--access-token <token>', 'Short-lived Chrome Web Store OAuth access token')
    .option('--upload-only', 'Upload without submitting the item for review')
    .option('--allow-warnings', 'Submit even when Chrome reports validation warnings')
    .action(async (options: { version?: string, serviceAccountPath?: string, accessToken?: string, uploadOnly?: boolean, allowWarnings?: boolean }) => {
      const { publishChromeExtension } = await import('@stacksjs/browser-extension')
      const { config, version } = await load()
      const result = await publishChromeExtension(config, {
        version: options.version ?? version,
        serviceAccountPath: options.serviceAccountPath,
        accessToken: options.accessToken,
        uploadOnly: Boolean(options.uploadOnly),
        blockOnWarnings: !options.allowWarnings,
      })
      if (result.deferred) {
        log.warn(`${result.deferred.reason}. Version ${options.version ?? version} remains queued for the next automated retry.`)
        return
      }
      if (result.alreadyPublished) {
        log.success(result.alreadyPublished.reason)
        return
      }
      log.success(`Uploaded Chrome package ${result.packagePath} (${result.upload?.crxVersion ?? 'processing complete'})`)
      if (result.publish)
        log.success(`Submitted Chrome Web Store item ${result.publish.itemId}: ${result.publish.state}`)
    })

  buddy
    .command('extension:firefox:previews', 'Sync the Firefox listing screenshots declared in config/extension.ts')
    .option('--api-key <issuer>', 'AMO JWT issuer')
    .option('--api-secret <secret>', 'AMO JWT secret')
    .option('--dry-run', 'Report what would change without touching the listing')
    .action(async (options: { apiKey?: string, apiSecret?: string, dryRun?: boolean }) => {
      const { syncFirefoxPreviews } = await import('@stacksjs/browser-extension')
      const { config } = await load()
      const result = await syncFirefoxPreviews(config, {
        issuer: options.apiKey,
        secret: options.apiSecret,
        dryRun: options.dryRun,
      })

      if (result.unchanged)
        log.info('Firefox listing screenshots already match config/extension.ts')
      else if (options.dryRun)
        log.info(`Would replace ${result.removed.length} Firefox listing screenshot(s)`)
      else
        log.success(`Synced ${result.uploaded.length} Firefox listing screenshot(s), removed ${result.removed.length}`)
    })

  buddy
    .command('extension:firefox:publish', 'Build and submit the Firefox extension through Mozilla Add-ons')
    .option('--version <version>', 'Override the extension version (defaults to package.json)')
    .option('--api-key <issuer>', 'AMO JWT issuer')
    .option('--api-secret <secret>', 'AMO JWT secret')
    .option('--source-code <path>', 'Human-readable source archive for AMO review')
    .option('--approval-timeout <milliseconds>', 'How long to wait for human approval (default 0)')
    .action(async (options: { version?: string, apiKey?: string, apiSecret?: string, sourceCode?: string, approvalTimeout?: string }) => {
      const { publishFirefoxExtension } = await import('@stacksjs/browser-extension')
      const { config, version } = await load()
      const result = await publishFirefoxExtension(config, {
        version: options.version ?? version,
        issuer: options.apiKey,
        secret: options.apiSecret,
        sourceCodePath: options.sourceCode,
        approvalTimeout: options.approvalTimeout === undefined ? undefined : Number(options.approvalTimeout),
      })
      log.success(`Submitted Firefox extension (${result.channel}) → ${result.artifactsDir}`)

      // AMO is the only one of the three stores whose API will take listing
      // screenshots on the way past. Never fatal: the add-on is already
      // submitted by this point, and a listing with yesterday's screenshots is
      // a better outcome than a publish reported as failed.
      if (config.firefoxAddons?.screenshots?.length) {
        try {
          const { syncFirefoxPreviews } = await import('@stacksjs/browser-extension')
          const previews = await syncFirefoxPreviews(config, { issuer: options.apiKey, secret: options.apiSecret })
          if (previews.unchanged)
            log.info('Firefox listing screenshots already match')
          else
            log.success(`Synced ${previews.uploaded.length} Firefox listing screenshot(s), removed ${previews.removed.length}`)
        }
        catch (error) {
          log.warn(`[extension:firefox:publish] listing screenshots left as they were: ${(error as Error).message}`)
        }
      }
      if (result.artifacts.length)
        log.info(`new artifacts: ${result.artifacts.join(', ')}`)
    })

  buddy
    .command('extension:safari:provision', 'Register Safari Bundle IDs and check the App Store Connect app record')
    .option('--api-key-id <id>', 'App Store Connect API key ID')
    .option('--api-issuer-id <id>', 'App Store Connect API issuer ID')
    .option('--api-key-path <path>', 'Path to the App Store Connect AuthKey_*.p8 file')
    .option('--check', 'Report missing resources without creating Bundle IDs')
    .option('--version <version>', 'Create or align App Store versions (defaults to package.json)')
    .option('--platform <platform>', 'Provision macos, ios, or all (defaults to config safariPlatforms)')
    .action(async (options: { apiKeyId?: string, apiIssuerId?: string, apiKeyPath?: string, check?: boolean, version?: string, platform?: string }) => {
      const { provisionSafariApp } = await import('@stacksjs/browser-extension')
      const { config, version } = await load()
      const result = await provisionSafariApp(config, {
        keyId: options.apiKeyId,
        issuerId: options.apiIssuerId,
        keyPath: options.apiKeyPath,
        checkOnly: Boolean(options.check),
        version: options.version ?? version,
        platforms: parseSafariPlatforms(options.platform),
      })
      for (const resource of [result.container, result.extension]) {
        if (resource.created)
          log.success(`Registered Bundle ID ${resource.identifier}`)
        else if (resource.exists)
          log.success(`Bundle ID exists: ${resource.identifier}`)
        else
          log.warn(`Bundle ID is missing: ${resource.identifier}`)
      }
      if (result.appRecord.exists)
        log.success(`App Store Connect app record exists (${result.appRecord.id})`)
      else
        log.warn('App Store Connect app record is missing. Apple requires creating it in the App Store Connect website.')
      for (const appStoreVersion of result.appStoreVersions) {
        const action = appStoreVersion.created ? 'Created' : appStoreVersion.updated ? 'Updated' : 'Ready'
        log.success(`${action} Safari ${appStoreVersion.platform} App Store version ${appStoreVersion.version}`)
      }
    })

  buddy
    .command('extension:safari:init', 'Scaffold the Safari container app (Xcode project) from the template')
    .option('--bundle-id <id>', 'Base bundle identifier (defaults to config safariBundleId)')
    .option('--dir <dir>', 'Output directory for the Xcode project (default safari)')
    .option('--force', 'Overwrite existing scaffold files')
    .option('--team-id <id>', 'Apple Developer team used for signing')
    .action(async (options: { bundleId?: string, dir?: string, force?: boolean, teamId?: string }) => {
      const { scaffoldSafariApp } = await import('@stacksjs/browser-extension')
      const { config } = await load()
      const { dir, written, skipped } = await scaffoldSafariApp(config, {
        bundleId: options.bundleId,
        dir: options.dir,
        force: Boolean(options.force),
        teamId: options.teamId,
      })
      log.success(`Scaffolded the Safari container app → ${dir} (${written.length} files)`)
      if (skipped.length)
        log.info(`kept ${skipped.length} existing files (use --force to overwrite)`)
    })

  buddy
    .command('extension:safari:app', 'Build the extension and its macOS, iPhone, and iPad Safari container apps')
    .option('--release', 'Build the Release configuration (default Debug)')
    .option('--signed', 'Sign locally against the Apple ID in Xcode (local builds only - see below)')
    .option('--skip-xcodebuild', 'Only build + sync the extension payload')
    .option('--version <version>', 'Override the extension version (defaults to package.json)')
    .option('--platform <platform>', 'Build macos, ios, or all (defaults to config safariPlatforms)')
    .action(async (options: { release?: boolean, signed?: boolean, skipXcodebuild?: boolean, version?: string, platform?: string }) => {
      const { buildSafariApp, buildSafariUniversalApp } = await import('@stacksjs/browser-extension')
      const { config, version } = await load()
      const platforms = parseSafariPlatforms(options.platform) ?? config.safariPlatforms ?? ['macos']
      if (platforms.includes('ios')) {
        const result = await buildSafariUniversalApp(config, {
          version: options.version ?? version,
          release: Boolean(options.release),
          signed: Boolean(options.signed),
          skipXcodebuild: Boolean(options.skipXcodebuild),
          platforms,
        })
        for (const platform of platforms) {
          const appPath = result.appPaths[platform]
          if (appPath)
            log.success(`Built Safari ${platform} app ${appPath}`)
        }
        if (options.skipXcodebuild)
          log.success(`Generated universal Safari project → ${result.project}`)
        if (result.appPaths.macos)
          log.info('Open the macOS app once, then enable the extension in Safari > Settings > Extensions.')
        if (result.appPaths.ios)
          log.info('Install the iOS app on an iPhone, iPad, or Simulator, then enable it in Settings > Apps > Safari > Extensions.')
        return
      }

      const { appPath, resources } = await buildSafariApp(config, {
        version: options.version ?? version,
        release: Boolean(options.release),
        signed: Boolean(options.signed),
        skipXcodebuild: Boolean(options.skipXcodebuild),
      })
      if (appPath) {
        log.success(`Built ${appPath}`)
        log.info('Open the app once, then enable the extension in Safari > Settings > Extensions.')
      }
      else {
        log.success(`Extension payload synced → ${resources}`)
      }
    })

  buddy
    .command('extension:safari:publish', 'Archive and validate or upload the Safari app to App Store Connect')
    .option('--version <version>', 'Override the marketing version (defaults to package.json)')
    .option('--build-number <number>', 'CFBundleVersion (defaults to GITHUB_RUN_NUMBER or Unix time)')
    .option('--team-id <id>', 'Apple Developer team (defaults to config safariTeamId)')
    .option('--api-key-id <id>', 'App Store Connect API key ID')
    .option('--api-issuer-id <id>', 'App Store Connect API issuer ID')
    .option('--api-key-path <path>', 'Path to the App Store Connect AuthKey_*.p8 file')
    .option('--validate-only', 'Create and validate the archive without uploading it')
    .option('--platform <platform>', 'Publish macos, ios, or all (defaults to config safariPlatforms)')
    .option('--skip-screenshots', 'Do not regenerate the App Store screenshot set before publishing')
    .action(async (options: { version?: string, buildNumber?: string, teamId?: string, apiKeyId?: string, apiIssuerId?: string, apiKeyPath?: string, validateOnly?: boolean, platform?: string, skipScreenshots?: boolean }) => {
      const { publishSafariApp } = await import('@stacksjs/browser-extension')
      const { config, version } = await load()

      // A listing's screenshots are the part most likely to be stale: they are
      // built from the product, and nothing fails when they fall behind it.
      // Rebuild them from `config/images.ts` on the way to the upload, so the
      // set that ships describes the build that ships. No-ops when the project
      // declares none.
      //
      // Never fatal. What gets uploaded is the committed set the config points
      // at; regenerating is a freshness pass over it, and a publish runner has
      // no reason to hold captures of a product it did not launch. Letting a
      // missing capture throw here took down the whole Safari publish — and
      // with it the Firefox and GitHub Release steps waiting behind it — for a
      // listing whose screenshots were sitting in the repository, correct.
      if (!options.skipScreenshots) {
        try {
          const { generateProjectImages } = await import('@stacksjs/actions')
          await generateProjectImages({ only: ['app-store'] })
        }
        catch (error) {
          log.warn(`[extension:safari:publish] using the committed screenshots - could not regenerate: ${(error as Error).message}`)
        }
      }

      const result = await publishSafariApp(config, {
        version: options.version ?? version,
        buildNumber: options.buildNumber,
        teamId: options.teamId,
        keyId: options.apiKeyId,
        issuerId: options.apiIssuerId,
        keyPath: options.apiKeyPath,
        validateOnly: Boolean(options.validateOnly),
        platforms: parseSafariPlatforms(options.platform),
      })
      for (const deferred of result.deferred)
        log.warn(`${deferred.reason}. Version ${deferred.version} remains queued for the next automated retry.`)
      for (const published of result.alreadyPublished)
        log.success(`Safari ${published.platform} version ${published.version} is already published${published.state ? ` (${published.state})` : ''}`)
      if (result.artifacts.length) {
        log.success(options.validateOnly
          ? `Validated Safari ${result.artifacts.map(artifact => artifact.platform).join(' + ')} archives (build ${result.buildNumber})`
          : `Uploaded and selected Safari ${result.attachments.map(attachment => attachment.platform).join(' + ')} build ${result.buildNumber} in App Store Connect`)
      }
      if (result.appStoreSubmission?.reviewSubmissionIds.length)
        log.success(`Submitted ${result.appStoreSubmission.reviewSubmissionIds.length} Safari version(s) to App Review`)
    })

  buddy
    .command('extension:safari:submit', 'Synchronize metadata and submit an existing Safari version to App Review')
    .option('--version <version>', 'Marketing version to submit (defaults to package.json)')
    .option('--api-key-id <id>', 'App Store Connect API key ID')
    .option('--api-issuer-id <id>', 'App Store Connect API issuer ID')
    .option('--api-key-path <path>', 'Path to the App Store Connect AuthKey_*.p8 file')
    .option('--platform <platform>', 'Submit macos, ios, or all (defaults to config safariPlatforms)')
    .option('--prepare-only', 'Synchronize the listing without submitting it for review')
    .action(async (options: { version?: string, apiKeyId?: string, apiIssuerId?: string, apiKeyPath?: string, platform?: string, prepareOnly?: boolean }) => {
      const { submitSafariAppStore } = await import('@stacksjs/browser-extension')
      const { config, version } = await load()
      const result = await submitSafariAppStore(config, {
        version: options.version ?? version,
        keyId: options.apiKeyId,
        issuerId: options.apiIssuerId,
        keyPath: options.apiKeyPath,
        platforms: parseSafariPlatforms(options.platform),
        submit: !options.prepareOnly,
      })
      log.success(`Synchronized ${result.versions.map(item => item.platform).join(' + ')} App Store listings`)
      if (result.reviewSubmissionIds.length)
        log.success(`Submitted ${result.reviewSubmissionIds.length} Safari version(s) to App Review`)
    })
}
