import type { ExtensionConfig, ExtensionTarget, SafariPlatform } from './types'
import { existsSync } from 'node:fs'
import { mkdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import process from 'node:process'
import { scaffoldSafariApp } from './safari'

export type ExtensionScaffoldTarget = ExtensionTarget | 'all'

export interface ExtensionProjectScaffoldOptions {
  cwd?: string
  name?: string
  target?: ExtensionScaffoldTarget
  bundleId?: string
  teamId?: string
  platforms?: SafariPlatform[]
  version?: string
  force?: boolean
}

export interface ExtensionProjectScaffoldResult {
  config: ExtensionConfig
  written: string[]
  skipped: string[]
  safari?: Awaited<ReturnType<typeof scaffoldSafariApp>>
}

export function resolveExtensionScaffoldTargets(target: ExtensionScaffoldTarget = 'all'): ExtensionTarget[] {
  return target === 'all' ? ['chrome', 'firefox', 'safari'] : [target]
}

function safariAppName(name: string): string {
  return name.replace(/[^A-Za-z0-9]/g, '') || 'MyExtension'
}

function quotedList(values: string[]): string {
  return `[${values.map(value => `'${value}'`).join(', ')}]`
}

function extensionConfigSource(config: ExtensionConfig): string {
  const safari = config.targets?.includes('safari')
    ? `\n  safariBundleId: '${config.safariBundleId}',\n  safariPlatforms: ${quotedList(config.safariPlatforms ?? ['macos', 'ios'])},\n  safariAppCategory: 'public.app-category.utilities',${config.safariTeamId ? `\n  safariTeamId: '${config.safariTeamId}',` : ''}`
    : ''
  const firefox = config.targets?.includes('firefox')
    ? `\n  // Replace this before publishing to Mozilla Add-ons.\n  geckoId: 'extension@example.com',`
    : ''

  return `import { defineExtension } from '@stacksjs/browser-extension'\n\nexport default defineExtension({\n  name: ${JSON.stringify(config.name)},\n  description: 'A browser extension built with Stacks.',\n  targets: ${quotedList(config.targets ?? [])},${firefox}${safari}\n  background: 'src/background/index.ts',\n  content: [\n    { entry: 'src/content/index.ts', matches: ['<all_urls>'], runAt: 'document_start' },\n  ],\n  pages: {\n    popup: { template: 'resources/views/popup.stx', script: 'resources/scripts/popup.ts' },\n  },\n  public: 'public',\n  manifest: {\n    permissions: ['storage', 'tabs'],\n  },\n})\n`
}

/** Scaffold a complete cross-browser extension, including Safari's container app. */
export async function scaffoldExtensionProject(options: ExtensionProjectScaffoldOptions = {}): Promise<ExtensionProjectScaffoldResult> {
  const cwd = options.cwd ?? process.cwd()
  const name = options.name ?? 'My Extension'
  const targets = resolveExtensionScaffoldTargets(options.target)
  const appName = safariAppName(name)
  const config: ExtensionConfig = {
    name,
    description: 'A browser extension built with Stacks.',
    targets,
    background: 'src/background/index.ts',
    content: [{ entry: 'src/content/index.ts', matches: ['<all_urls>'], runAt: 'document_start' }],
    pages: { popup: { template: 'resources/views/popup.stx', script: 'resources/scripts/popup.ts' } },
    public: 'public',
    manifest: { permissions: ['storage', 'tabs'] },
    ...(targets.includes('firefox') && { geckoId: 'extension@example.com' }),
    ...(targets.includes('safari') && {
      safariBundleId: options.bundleId ?? `com.example.${appName}`,
      safariTeamId: options.teamId,
      safariPlatforms: options.platforms ?? ['macos', 'ios'],
      safariAppCategory: 'public.app-category.utilities',
    }),
  }
  const written: string[] = []
  const skipped: string[] = []

  const write = async (relative: string, content: string): Promise<void> => {
    const absolute = join(cwd, relative)
    if (existsSync(absolute) && !options.force) {
      skipped.push(relative)
      return
    }
    await mkdir(dirname(absolute), { recursive: true })
    await Bun.write(absolute, content)
    written.push(relative)
  }

  await write('config/extension.ts', extensionConfigSource(config))
  await write('src/background/index.ts', `console.log(${JSON.stringify(`[${name}] background ready`)})\n`)
  await write('src/content/index.ts', `console.log(${JSON.stringify(`[${name}] content script loaded`)})\n`)
  await write('resources/scripts/popup.ts', `console.log(${JSON.stringify(`[${name}] popup ready`)})\n`)
  await write('resources/views/popup.stx', `<main class="popup">\n  <h1>${name}</h1>\n  <p>Edit resources/views/popup.stx to build your popup.</p>\n  <script src="/popup.js"></script>\n</main>\n`)
  await mkdir(join(cwd, 'public'), { recursive: true })

  const safari = targets.includes('safari')
    ? await scaffoldSafariApp(config, {
        cwd,
        bundleId: config.safariBundleId,
        teamId: config.safariTeamId,
        version: options.version,
        force: options.force,
      })
    : undefined

  return { config, written, skipped, safari }
}
