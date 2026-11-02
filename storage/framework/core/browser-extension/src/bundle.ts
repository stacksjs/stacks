import { resolve } from 'node:path'

/** Bundle one entrypoint to a classic IIFE script (content scripts + page scripts). */
export async function bundleScript(entry: string, cwd: string, minify: boolean): Promise<string> {
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
  return output.text()
}

/**
 * Load what a rules module produces. `path#name` reads that export; a bare
 * path reads its default export, `buildRules` or `rules`, else its sole
 * exported function or array. A function is called (and awaited).
 */
export async function loadModuleValue<T = unknown>(cwd: string, source: string): Promise<T> {
  const [path, name] = source.split('#') as [string, string | undefined]
  const mod = await import(resolve(cwd, path))
  if (name !== undefined && !(name in mod))
    throw new Error(`[browser-extension] ${path} has no export named "${name}"`)
  const build = name !== undefined
    ? mod[name]
    : mod.default ?? mod.buildRules ?? mod.rules
      ?? Object.values(mod).find(v => typeof v === 'function')
      ?? Object.values(mod).find(v => Array.isArray(v))
  return (typeof build === 'function' ? await build() : build) as T
}
