import type { CLI } from '@stacksjs/types'
import process from 'node:process'
import { log } from '@stacksjs/cli'

interface ExtensionOptions {
  target?: 'chrome' | 'firefox'
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
    .command('extension:build', 'Build the browser extension (Chrome + Firefox) from config/extension.ts')
    .option('--target <target>', 'Build a single target (chrome | firefox); omit to build all')
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
    .option('--target <target>', 'Package a single target (chrome | firefox); omit to package all')
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
}
