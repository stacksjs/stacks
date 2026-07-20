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
      log.error('No extension config found. Create `config/extension.ts` exporting `defineExtension({ … })`.')
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
    .command('extension:init', 'Scaffold a browser extension (config/extension.ts + starter background/content/pages)')
    .option('--name <name>', 'Extension display name')
    .action(async (options: { name?: string }) => {
      const { existsSync } = await import('node:fs')
      const { mkdir, writeFile } = await import('node:fs/promises')
      const { dirname, join } = await import('node:path')
      const cwd = process.cwd()
      const name = options.name ?? 'My Extension'

      const write = async (rel: string, content: string) => {
        const abs = join(cwd, rel)
        if (existsSync(abs)) {
          log.info(`skip (exists): ${rel}`)
          return
        }
        await mkdir(dirname(abs), { recursive: true })
        await writeFile(abs, content)
        log.success(`created ${rel}`)
      }

      await write('config/extension.ts', `import { defineExtension } from '@stacksjs/browser-extension'\n\nexport default defineExtension({\n  name: ${JSON.stringify(name)},\n  description: 'A browser extension built with Stacks.',\n  targets: ['chrome', 'firefox'],\n  background: 'src/background/index.ts',\n  content: [\n    { entry: 'src/content/index.ts', matches: ['<all_urls>'], runAt: 'document_start' },\n  ],\n  pages: {\n    popup: { template: 'pages/popup.stx', script: 'src/ui/popup.ts' },\n  },\n  icons: { 16: 'icons/icon-16.png', 48: 'icons/icon-48.png', 128: 'icons/icon-128.png' },\n  public: 'public',\n  manifest: {\n    permissions: ['storage', 'tabs'],\n  },\n})\n`)
      await write('src/background/index.ts', `// Background service worker (MV3).\nconsole.log('[${name}] background ready')\n`)
      await write('src/content/index.ts', `// Content script — runs on matched pages.\nconsole.log('[${name}] content script loaded')\n`)
      await write('src/ui/popup.ts', `// Popup script.\nconsole.log('[${name}] popup')\n`)
      await write('pages/popup.stx', `<div class="popup">\n  <h1>${name}</h1>\n  <p>Edit pages/popup.stx to build your popup.</p>\n  <script src="/popup.js"></script>\n</div>\n`)
      log.info('Next: add icons under public/icons, then `buddy extension:build`.')
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
      log.success(`Uploaded Chrome package ${result.packagePath} (${result.upload.crxVersion ?? 'processing complete'})`)
      if (result.publish)
        log.success(`Submitted Chrome Web Store item ${result.publish.itemId}: ${result.publish.state}`)
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
    .option('--signed', 'Allow code signing (needs an Apple Development identity)')
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
    .action(async (options: { version?: string, buildNumber?: string, teamId?: string, apiKeyId?: string, apiIssuerId?: string, apiKeyPath?: string, validateOnly?: boolean, platform?: string }) => {
      const { publishSafariApp } = await import('@stacksjs/browser-extension')
      const { config, version } = await load()
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
      log.success(options.validateOnly
        ? `Validated Safari ${result.artifacts.map(artifact => artifact.platform).join(' + ')} archives (build ${result.buildNumber})`
        : `Uploaded and selected Safari ${result.attachments.map(attachment => attachment.platform).join(' + ')} build ${result.buildNumber} in App Store Connect`)
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
