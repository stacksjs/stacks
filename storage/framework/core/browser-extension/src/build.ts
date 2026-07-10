import type { BuildOptions, ExtensionConfig, ExtensionTarget } from './types'
import { cp, mkdir, rm } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { contentScriptOut, generateManifest } from './manifest'

/** Resolve the output directory for a target. */
export function resolveOutdir(config: ExtensionConfig, target: ExtensionTarget, override?: string): string {
  if (override)
    return override
  if (typeof config.outdir === 'string')
    return config.outdir
  if (config.outdir?.[target])
    return config.outdir[target] as string
  return target === 'firefox' ? 'dist-firefox' : 'dist'
}

/**
 * Build a browser extension for one target: bundle stx pages → HTML, content +
 * background scripts → classic IIFE bundles, copy static assets, and write the
 * generated manifest.json. Mirrors the hand-rolled build-extension.ts every
 * extension used to carry, now driven purely by `ExtensionConfig`.
 *
 * The stx page bundling is delegated to `bun-plugin-stx` (loaded lazily so the
 * package doesn't hard-depend on it when only the manifest/packaging APIs are
 * used).
 */
export async function buildExtension(config: ExtensionConfig, options: BuildOptions): Promise<{ outdir: string, target: ExtensionTarget }> {
  const target = options.target ?? 'chrome'
  const cwd = options.cwd ?? process.cwd()
  const outdir = resolve(cwd, resolveOutdir(config, target, options.outdir))
  const minify = options.minify ?? true

  await rm(outdir, { recursive: true, force: true })
  await mkdir(outdir, { recursive: true })

  // 1. Static assets (icons, stubs, …) copied verbatim first so later steps can
  //    overwrite generated files on top.
  if (config.public) {
    const pub = resolve(cwd, config.public)
    if (existsSync(pub))
      await cp(pub, outdir, { recursive: true })
  }

  // 2. stx pages → HTML (+ their chunked assets).
  const pageEntries = collectPages(config, cwd)
  if (pageEntries.length) {
    // bun-plugin-stx's default export is a factory — call it to get the plugin.
    const { default: stxPlugin } = await import('bun-plugin-stx')
    await Bun.build({
      entrypoints: pageEntries,
      outdir,
      target: 'browser',
      minify,
      plugins: [(stxPlugin as unknown as () => any)()],
    })
  }

  // 3. Content + background scripts → classic IIFE bundles. These load as
  //    non-module content scripts, so `format: 'iife'` (never esm) is required.
  const scripts: Array<{ entry: string, out: string }> = []
  if (config.background)
    scripts.push({ entry: config.background, out: 'background.js' })
  for (const cs of config.content ?? [])
    scripts.push({ entry: cs.entry, out: contentScriptOut(cs.entry, cs.out) })

  await Promise.all(scripts.map(async ({ entry, out }) => {
    const result = await Bun.build({
      entrypoints: [resolve(cwd, entry)],
      target: 'browser',
      format: 'iife',
      minify,
    })
    if (!result.success)
      throw new Error(`[browser-extension] failed to build ${entry}: ${result.logs.join('\n')}`)
    await Bun.write(join(outdir, out), await result.outputs[0].text())
  }))

  // 4. manifest.json
  await Bun.write(
    join(outdir, 'manifest.json'),
    `${JSON.stringify(generateManifest(config, { version: options.version, target }), null, 2)}\n`,
  )

  return { outdir, target }
}

function collectPages(config: ExtensionConfig, cwd: string): string[] {
  const p = config.pages
  if (!p)
    return []
  const entries = [p.popup, p.options, ...Object.values(p.extra ?? {})].filter(Boolean) as string[]
  return entries.map(e => resolve(cwd, e))
}

/** Build every configured target. */
export async function buildAllTargets(config: ExtensionConfig, options: Omit<BuildOptions, 'target'>): Promise<void> {
  for (const target of config.targets ?? ['chrome', 'firefox'])
    await buildExtension(config, { ...options, target })
}
