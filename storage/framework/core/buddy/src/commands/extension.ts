import type { CLI } from '@stacksjs/types'
import process from 'node:process'
import { log } from '@stacksjs/cli'

interface ExtensionOptions {
  target?: 'chrome' | 'firefox' | 'safari'
  version?: string
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
    .command('extension:safari:app', 'Build the extension, sync it into the appex, and xcodebuild the container app')
    .option('--release', 'Build the Release configuration (default Debug)')
    .option('--signed', 'Allow code signing (needs an Apple Development identity)')
    .option('--skip-xcodebuild', 'Only build + sync the extension payload')
    .option('--version <version>', 'Override the extension version (defaults to package.json)')
    .action(async (options: { release?: boolean, signed?: boolean, skipXcodebuild?: boolean, version?: string }) => {
      const { buildSafariApp } = await import('@stacksjs/browser-extension')
      const { config, version } = await load()
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
    .action(async (options: { version?: string, buildNumber?: string, teamId?: string, apiKeyId?: string, apiIssuerId?: string, apiKeyPath?: string, validateOnly?: boolean }) => {
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
      })
      log.success(options.validateOnly
        ? `Validated Safari archive ${result.archivePath} (build ${result.buildNumber})`
        : `Uploaded Safari build ${result.buildNumber} to App Store Connect`)
    })
}
