import type { BuildOptions, ContentScript, ExtensionConfig, ExtensionPage, ExtensionPages, ExtensionTarget } from './types'
import { Glob } from 'bun'
import { cp, mkdir, rm } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { contentScriptOut, generateManifest } from './manifest'
import { sanitizeExtensionHtml } from './sanitize'

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

function normalizePage(page: string | ExtensionPage): ExtensionPage {
  return typeof page === 'string' ? { template: page } : page
}

/** `<name, page>` entries for the configured pages (popup/options/extra). */
function pageEntries(pages?: ExtensionPages): Array<{ name: string, page: ExtensionPage }> {
  if (!pages)
    return []
  const out: Array<{ name: string, page: ExtensionPage }> = []
  if (pages.popup)
    out.push({ name: 'popup', page: normalizePage(pages.popup) })
  if (pages.options)
    out.push({ name: 'options', page: normalizePage(pages.options) })
  for (const [name, page] of Object.entries(pages.extra ?? {}))
    out.push({ name, page: normalizePage(page) })
  return out
}

/** Bundle one entrypoint to a classic IIFE script (content scripts + page scripts). */
async function buildScript(entry: string, out: string, outdir: string, cwd: string, minify: boolean): Promise<void> {
  const result = await Bun.build({
    entrypoints: [resolve(cwd, entry)],
    target: 'browser',
    // IIFE, never esm: these load as classic scripts; esm top-level vars become
    // window globals and collide with the page's own (MAIN-world) minified names.
    format: 'iife',
    splitting: false,
    minify,
  })
  if (!result.success)
    throw new Error(`[browser-extension] failed to build ${entry}: ${result.logs.join('\n')}`)
  const output = result.outputs[0]
  if (!output)
    throw new Error(`[browser-extension] build produced no output for ${entry}`)
  await Bun.write(join(outdir, out), await output.text())
}

/**
 * Build a browser extension for one target from `ExtensionConfig`:
 * - static assets (`public/**`) + extra `assets` copied in
 * - stx pages → `<name>.html` (+ companion `<name>.js`), sanitized for the
 *   extension CSP, with stx dev chunks removed
 * - content + background scripts → classic IIFE bundles
 * - declarativeNetRequest rulesets compiled from their `source` modules
 * - `manifest.json` generated per target
 * - the app's `hooks.postBuild` run last
 *
 * Replaces the hand-rolled `build-extension.ts` every extension used to carry.
 */
export async function buildExtension(config: ExtensionConfig, options: BuildOptions): Promise<{ outdir: string, target: ExtensionTarget }> {
  const target = options.target ?? 'chrome'
  const cwd = options.cwd ?? process.cwd()
  const outdir = resolve(cwd, resolveOutdir(config, target, options.outdir))
  const minify = options.minify ?? true

  await rm(outdir, { recursive: true, force: true })
  await mkdir(join(outdir, 'rules'), { recursive: true })
  await mkdir(join(outdir, 'icons'), { recursive: true })

  // 1. Static assets first, so generated files can overwrite on top.
  if (config.public) {
    const pub = resolve(cwd, config.public)
    if (existsSync(pub))
      await cp(pub, outdir, { recursive: true })
  }
  for (const [dest, src] of Object.entries(config.assets ?? {})) {
    const s = resolve(cwd, src)
    if (existsSync(s))
      await Bun.write(join(outdir, dest), Bun.file(s))
  }

  // 2. Page scripts (popup.ts → popup.js, …) — built before the HTML is
  //    sanitized so we know each page's own script name to keep.
  const pages = pageEntries(config.pages)
  await Promise.all(pages
    .filter(p => p.page.script)
    .map(p => buildScript(p.page.script as string, `${p.name}.js`, outdir, cwd, minify)))

  // 3. stx pages → HTML, then sanitize each for the extension CSP.
  if (pages.length) {
    const { default: stxPlugin } = await import('bun-plugin-stx')
    const result = await Bun.build({
      entrypoints: pages.map(p => resolve(cwd, p.page.template)),
      outdir,
      minify,
      naming: { entry: '[name].html' },
      plugins: [(stxPlugin as unknown as () => any)()],
    })
    if (!result.success)
      throw new Error(`[browser-extension] failed to build pages: ${result.logs.join('\n')}`)

    for (const { name, page } of pages) {
      const file = join(outdir, `${name}.html`)
      if (!existsSync(file))
        continue
      const own = page.script ? [`${name}.js`] : []
      await Bun.write(file, sanitizeExtensionHtml(await Bun.file(file).text(), own))
    }

    // stx emits `chunk-*.js` helpers that extension pages must not ship.
    for await (const chunk of new Glob('chunk-*.js').scan(outdir))
      await rm(join(outdir, chunk), { force: true })
  }

  // 4. Content + background scripts → IIFE bundles.
  const scripts: Array<{ entry: string, out: string }> = []
  if (config.background)
    scripts.push({ entry: config.background, out: 'background.js' })
  for (const cs of config.content ?? [])
    scripts.push({ entry: cs.entry, out: contentScriptOut(cs.entry, cs.out) })
  await Promise.all(scripts.map(s => buildScript(s.entry, s.out, outdir, cwd, minify)))

  // 5. Compile declarativeNetRequest rulesets from their source modules.
  for (const rule of config.rules ?? []) {
    if (!rule.source)
      continue
    const mod = await import(resolve(cwd, rule.source))
    // Prefer an explicit export; otherwise the sole exported function/array.
    const build = mod.default ?? mod.buildRules ?? mod.rules
      ?? Object.values(mod).find(v => typeof v === 'function')
      ?? Object.values(mod).find(v => Array.isArray(v))
    const data = typeof build === 'function' ? await build() : build
    await Bun.write(join(outdir, rule.path ?? `rules/${rule.id}.json`), `${JSON.stringify(data, null, 2)}\n`)
  }

  // 6. manifest.json
  await Bun.write(
    join(outdir, 'manifest.json'),
    `${JSON.stringify(generateManifest(config, { version: options.version, target }), null, 2)}\n`,
  )

  // 7. App-specific post-processing.
  await config.hooks?.postBuild?.({ config, target, outdir, version: options.version, cwd })

  return { outdir, target }
}

/** Build every configured target. */
export async function buildAllTargets(config: ExtensionConfig, options: Omit<BuildOptions, 'target'>): Promise<void> {
  for (const target of config.targets ?? ['chrome', 'firefox'])
    await buildExtension(config, { ...options, target })
}
