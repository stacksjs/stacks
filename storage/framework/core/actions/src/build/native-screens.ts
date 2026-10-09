import type { IosMobileConfig } from '@stacksjs/types'
import { existsSync, mkdirSync } from 'node:fs'
import { join, resolve } from 'node:path'

/** What stx's native compiler answers (`@stacksjs/stx/native`). */
interface NativeBundleResult {
  outFile: string
  diagnostics?: Array<{ level?: string, message: string, file?: string }>
}

type CompileNativeBundle = (options: {
  screens: Record<string, string>
  initialScreen?: string
  minify?: boolean
  outFile: string
  root?: string
}) => Promise<NativeBundleResult>

/**
 * The `.stx` file each native screen is drawn from: one per screen name in
 * `nativeScreens`, in `nativeScreensDir` (`resources/native` by default).
 * A screen named twice, for two paths, is compiled once.
 */
export function nativeScreenFiles(config: Pick<IosMobileConfig, 'nativeScreens' | 'nativeScreensDir'>, root: string): Record<string, string> {
  const dir = resolve(root, config.nativeScreensDir ?? 'resources/native')
  const files: Record<string, string> = {}
  for (const name of Object.values(config.nativeScreens ?? {})) {
    if (files[name]) continue
    const file = join(dir, `${name}.stx`)
    if (!existsSync(file))
      throw new Error(`ios.nativeScreens names the screen "${name}", but ${file} does not exist.`)
    files[name] = file
  }
  return files
}

/**
 * Compiles the app's native screens into the one bundle Craft runs them from,
 * and answers its path; nothing when the app has none. The bundle goes in the
 * generated project's own folder, so a rebuild replaces it and git never sees
 * it.
 */
export async function compileNativeScreens(
  config: Pick<IosMobileConfig, 'nativeScreens' | 'nativeScreensDir'>,
  root: string,
  output: string,
  compile?: CompileNativeBundle,
): Promise<{ outFile: string, diagnostics: NativeBundleResult['diagnostics'] } | null> {
  const screens = nativeScreenFiles(config, root)
  const names = Object.keys(screens)
  if (!names.length) return null

  const compileBundle = compile ?? (await import('@stacksjs/stx/native') as { compileNativeBundle: CompileNativeBundle }).compileNativeBundle
  mkdirSync(output, { recursive: true })
  const outFile = join(output, 'native-screens.js')
  const result = await compileBundle({ screens, initialScreen: names[0], minify: true, outFile, root })
  return { outFile: result.outFile || outFile, diagnostics: result.diagnostics ?? [] }
}
