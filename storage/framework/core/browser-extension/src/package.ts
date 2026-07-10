import type { ExtensionConfig, ExtensionTarget } from './types'
import { existsSync } from 'node:fs'
import { mkdir } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { buildExtension, resolveOutdir } from './build'

export interface PackageOptions {
  target?: ExtensionTarget
  version: string
  cwd?: string
  /** Output .zip path. @default `<slug>-<version>[-firefox].zip` */
  outfile?: string
  /** Rebuild before zipping. @default true */
  build?: boolean
}

/** kebab-case slug from the extension name, for the default zip filename. */
function slug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

/**
 * Package a built extension into a store-ready `.zip` (one per target). Builds
 * first unless `build: false`. Uses the system `zip` (available on CI runners
 * and dev machines) so the archive matches what the Chrome/Firefox stores
 * expect (files at the archive root, no wrapping directory).
 */
export async function packageExtension(config: ExtensionConfig, options: PackageOptions): Promise<string> {
  const target = options.target ?? 'chrome'
  const cwd = options.cwd ?? process.cwd()

  if (options.build !== false)
    await buildExtension(config, { target, version: options.version, cwd })

  const outdir = resolve(cwd, resolveOutdir(config, target))
  if (!existsSync(outdir))
    throw new Error(`[browser-extension] nothing to package: ${outdir} does not exist`)

  const suffix = target === 'firefox' ? '-firefox' : ''
  const outfile = resolve(cwd, options.outfile ?? `${slug(config.name)}-${options.version}${suffix}.zip`)
  await mkdir(dirname(outfile), { recursive: true })

  // Zip the *contents* of outdir (cwd = outdir, glob '.') so manifest.json is at
  // the archive root — a wrapping folder makes stores reject the upload.
  const proc = Bun.spawn(['zip', '-r', '-q', outfile, '.'], { cwd: outdir, stdout: 'pipe', stderr: 'pipe' })
  const code = await proc.exited
  if (code !== 0)
    throw new Error(`[browser-extension] zip failed (${code}): ${await new Response(proc.stderr).text()}`)

  return outfile
}
