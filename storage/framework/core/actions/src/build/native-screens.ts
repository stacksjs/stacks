import type { IosMobileConfig } from '@stacksjs/types'
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

/** What stx's native compiler answers (`@stacksjs/stx/native`). */
interface NativeBundleResult {
  outFile?: string
  /** The bundle's code; with no `outFile`, nothing was written. */
  code?: string
  /** Each route's own file, when `routesDir` was given (stx 0.2.571 and later). */
  routes?: Record<string, string>
  diagnostics?: Array<{ level?: string, message: string, file?: string }>
}

type CompileNativeBundle = (options: {
  screens: Record<string, string>
  initialScreen?: string
  minify?: boolean
  outFile?: string
  /** One bundle per route, in this directory, instead of one for all. */
  routesDir?: string
  root?: string
  /** The app script, run once beside the screens (stx 0.2.504 and later). */
  app?: string
}) => Promise<NativeBundleResult>

/**
 * The `.stx` file each native screen is drawn from: one per screen name in
 * `nativeScreens`, in `nativeScreensDir` (`resources/native` by default).
 * A screen named twice, for two paths, is compiled once.
 */
export function nativeScreenFiles(config: Pick<IosMobileConfig, 'nativeScreens' | 'nativeScreensDir'>, root: string, section: 'ios' | 'android' = 'ios'): Record<string, string> {
  const dir = resolve(root, config.nativeScreensDir ?? 'resources/native')
  const files: Record<string, string> = {}
  for (const name of Object.values(config.nativeScreens ?? {})) {
    if (files[name]) continue
    const file = join(dir, `${name}.stx`)
    if (!existsSync(file))
      throw new Error(`${section}.nativeScreens names the screen "${name}", but ${file} does not exist.`)
    files[name] = file
  }
  return files
}

/** The app script's file (`nativeApp`), or null when the app has none. */
export function nativeAppFile(config: Pick<IosMobileConfig, 'nativeApp'>, root: string, section: 'ios' | 'android' = 'ios'): string | null {
  if (!config.nativeApp) return null
  const file = resolve(root, config.nativeApp)
  if (!existsSync(file))
    throw new Error(`${section}.nativeApp names ${config.nativeApp}, but ${file} does not exist.`)
  return file
}

/**
 * Compiles the app's native screens into what Craft runs them from, and
 * answers its path; nothing when the app has none. It goes in the generated
 * project's own folder, so a rebuild replaces it and git never sees it.
 *
 * With `routes` (a Craft that runs each screen from its own file, its
 * builder's `nativeRouteBundles`), that is a directory of one bundle per
 * route. Every screen is a JavaScriptCore context that evaluates the whole
 * file it is given, so one file of every screen made each tab, push and the
 * app script parse all of them first: ~170 ms of main thread per screen for
 * HQ's 17 MB. Otherwise, the one-file bundle.
 */
export async function compileNativeScreens(
  config: Pick<IosMobileConfig, 'nativeScreens' | 'nativeScreensDir' | 'nativeApp'>,
  root: string,
  output: string,
  compile?: CompileNativeBundle,
  /** Which section of config/mobile.ts the screens came from, for the errors. */
  section: 'ios' | 'android' = 'ios',
  options: { routes?: boolean } = {},
): Promise<{ outFile: string, diagnostics: NativeBundleResult['diagnostics'] } | null> {
  const screens = nativeScreenFiles(config, root, section)
  const names = Object.keys(screens)
  const app = nativeAppFile(config, root, section)
  if (!names.length) {
    if (app) throw new Error(`${section}.nativeApp runs beside native screens: list them in ${section}.nativeScreens`)
    return null
  }

  const compileBundle = compile ?? (await import('@stacksjs/stx/native') as { compileNativeBundle: CompileNativeBundle }).compileNativeBundle
  mkdirSync(output, { recursive: true })
  const outFile = join(output, 'native-screens.js')
  const routesDir = join(output, 'native-screens')
  // Whichever layout this build makes, the other one's leftovers go, so
  // Craft can never install a stale copy beside the fresh one.
  rmSync(options.routes ? outFile : routesDir, { recursive: true, force: true })
  if (options.routes) {
    rmSync(routesDir, { recursive: true, force: true })
    const result = await compileBundle({ screens, initialScreen: names[0], minify: true, routesDir, root, ...(app ? { app } : {}) })
    if (result.routes && Object.keys(result.routes).length)
      return { outFile: routesDir, diagnostics: result.diagnostics ?? [] }
    // An stx without routesDir answered the one-file bundle's code instead.
    if (!result.code) throw new Error('stx compiled no native bundle: it wrote no route files and returned no code')
    writeFileSync(outFile, result.code)
    return { outFile, diagnostics: result.diagnostics ?? [] }
  }
  const result = await compileBundle({ screens, initialScreen: names[0], minify: true, outFile, root, ...(app ? { app } : {}) })
  return { outFile: result.outFile || outFile, diagnostics: result.diagnostics ?? [] }
}
