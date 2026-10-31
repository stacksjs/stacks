import type { ResolvedMacosDesktop } from '@stacksjs/desktop-build'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import process from 'node:process'
import { pathToFileURL } from 'node:url'
import { log } from '@stacksjs/cli'
import { macosOutputDirectory, macosScreens, validateMacosDesktop } from '@stacksjs/desktop-build'
import { projectPath, storagePath } from '@stacksjs/path'
import { craftBuilderVersion } from './craft-entry'

/**
 * What a native macOS app needs before it can be a bundle: its stx screens
 * compiled to the script Craft's AppKit host runs, and the host itself. Shared
 * by `buddy build:desktop` (a development app) and `buddy desktop:apple:package`
 * (the sandboxed Mac App Store app), so the two cannot drift.
 *
 * Nothing here is project-specific. The Zig compiler and the zig-js engine the
 * host is built with come from Craft's `resolveMacOSToolchain` (Pantry installs
 * the pinned compiler), so an app carries no toolchain lock file of its own.
 */

interface CraftMacosBuilder {
  buildMacOSNative: (options: { outdir: string, nativeBundle: string }) => Promise<{ executable: string, bundle: string }>
}

type CompileNativeBundle = (options: {
  screens: Record<string, string>
  initialScreen?: string
  minify?: boolean
  outFile?: string
  root?: string
  app?: string
  shareStorage?: Record<string, string>
}) => Promise<{ outFile?: string, diagnostics?: Array<{ level?: string, message: string, file?: string }> }>

/** `CRAFT_MACOS_SRC` (a Craft checkout's packages/macos/src/index.ts) or the copy of craft-native the desktop package resolves. */
function craftMacosEntry(root: string): string {
  if (process.env.CRAFT_MACOS_SRC) return pathToFileURL(process.env.CRAFT_MACOS_SRC).href
  try {
    const desktop = Bun.resolveSync('@stacksjs/desktop-build/package.json', root)
    return pathToFileURL(Bun.resolveSync('craft-native/macos', dirname(desktop))).href
  }
  catch {
    return 'craft-native/macos'
  }
}

/** What the host binary depends on, so a rebuilt screen reuses it and a new Craft does not. */
function hostKey(entry: string, root: string): string {
  const hash = createHash('sha256')
  const path = entry.startsWith('file:') ? new URL(entry).pathname : entry
  const version = craftBuilderVersion(entry, root)?.version
  hash.update(version ?? 'unversioned')
  if (process.env.CRAFT_MACOS_SRC || !version) {
    const templates = join(dirname(path), '../templates')
    if (existsSync(templates)) for (const file of readdirSync(templates).sort()) hash.update(readFileSync(join(templates, file)))
  }
  return hash.digest('hex').slice(0, 16)
}

export interface PreparedMacosNative {
  root: string
  /** Where the app goes. */
  output: string
  /** The compiled screens. */
  nativeBundle: string
  /** Craft's AppKit host executable. */
  host: string
  /** What the host was built from, for provenance. */
  hostKey: string
}

export async function prepareMacosNative(config: ResolvedMacosDesktop, options: { root?: string } = {}): Promise<PreparedMacosNative> {
  const root = options.root ?? projectPath()
  const errors = validateMacosDesktop(config)
  if (errors.length) throw new Error(`config/desktop.ts macos is not buildable:\n${errors.map(error => `  - ${error}`).join('\n')}`)
  if (process.platform !== 'darwin') throw new Error('The native macOS app builds on macOS')

  const output = macosOutputDirectory(root, config)
  const work = join(output, '.build')
  mkdirSync(work, { recursive: true })

  // 1. The screens: stx compiled to the script Craft's AppKit host runs.
  const screens = Object.fromEntries(Object.entries(macosScreens(config)).map(([name, file]) => [name, join(root, file)]))
  for (const [name, file] of Object.entries(screens)) if (!existsSync(file)) throw new Error(`macos.nativeScreens: screen "${name}" is ${file}, which does not exist`)
  // `STX_NATIVE_SRC` (an stx checkout's packages/stx/src/native/index.ts) is the development override, as `CRAFT_MACOS_SRC` is for Craft.
  const { compileNativeBundle } = await import(process.env.STX_NATIVE_SRC ? pathToFileURL(process.env.STX_NATIVE_SRC).href : '@stacksjs/stx/native') as { compileNativeBundle: CompileNativeBundle }
  const app = config.nativeApp ? join(root, config.nativeApp) : undefined
  const compiled = await compileNativeBundle({
    screens,
    initialScreen: config.initialScreen,
    minify: true,
    outFile: join(work, 'native-screen.js'),
    root,
    ...(app ? { app } : {}),
    ...(config.shareStorage && Object.keys(config.shareStorage).length ? { shareStorage: { ...config.shareStorage } } : {}),
  })
  // A <script> in a native screen is run by the host, not drawn: stx notes it as dropped from the view tree.
  const problems = (compiled.diagnostics ?? []).filter(item => item.message !== 'dropped-subtree: script')
  for (const item of problems) await log.warn(`${item.file ? `${item.file}: ` : ''}${item.message}`)
  if (problems.some(item => item.level === 'error')) throw new Error('The native screens did not compile')
  const nativeBundle = compiled.outFile ?? join(work, 'native-screen.js')

  // 2. The host: Craft's AppKit renderer, built once per Craft revision.
  const entry = craftMacosEntry(root)
  const hostDirectory = storagePath(`framework/desktop/host/${hostKey(entry, root)}`)
  const host = join(hostDirectory, 'craft-native-macos')
  if (!existsSync(host)) {
    await log.info('Building the AppKit host (first build for this Craft; the toolchain installs through Pantry)')
    const builder = await import(entry) as CraftMacosBuilder
    mkdirSync(hostDirectory, { recursive: true })
    await builder.buildMacOSNative({ outdir: hostDirectory, nativeBundle })
  }

  return { root, output, nativeBundle, host, hostKey: hostKey(entry, root) }
}
