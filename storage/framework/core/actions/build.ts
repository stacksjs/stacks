/**
 * Build the @stacksjs/actions package.
 *
 * Each `src/**\/*.ts` file is its own entrypoint because `runAction()`
 * shells out to `bun <path>` per command — there's no single bundle that
 * covers them all. Auto-discovery beats the old hand-maintained list,
 * which had drifted (route/list, queue/*, dev/api, database/migrate, etc.
 * were all missing, so `bun install`-only consumers couldn't run them).
 *
 * Output is minified for cold-start perf: each subprocess invocation pays
 * the parse cost once, and minified JS is materially faster than transpiling
 * TS source on every spawn.
 */

import { readdir } from 'node:fs/promises'
import { join, relative } from 'node:path'
import { dts } from 'bun-plugin-dtsx'
import { intro, outro } from '../build/src'

const { startTime } = await intro({
  dir: import.meta.dir,
})

const SRC_ROOT = `${import.meta.dir}/src`

async function listEntrypoints(): Promise<string[]> {
  const out: string[] = []
  async function walk(dir: string): Promise<void> {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name)
      if (entry.isDirectory()) {
        await walk(full)
        continue
      }
      if (!entry.isFile()) continue
      if (!entry.name.endsWith('.ts') || entry.name.endsWith('.d.ts')) continue
      out.push(`./${relative(import.meta.dir, full)}`)
    }
  }
  await walk(SRC_ROOT)
  return out.sort()
}

const entrypoints = await listEntrypoints()
console.log(`[actions/build] ${entrypoints.length} entrypoints discovered under src/`)

const result = await Bun.build({
  root: '.',
  outdir: './dist',
  format: 'esm',
  target: 'bun',
  minify: true,
  splitting: true,

  entrypoints,

  // Mark every framework-internal package as external so dist files don't
  // re-bundle them (and so users can swap them out via node_modules). All
  // other deps (ts-faker, bun-query-builder, etc.) are also resolved at
  // runtime via node_modules — the bundler shouldn't try to inline them.
  external: [
    '@stacksjs/*',
    'bun',
    'bun:*',
    'node:*',
    // In-house peers we keep external so they update independently:
    //   - ts-md     — markdown parser used by the component-meta extractor
    //   - @craft-native/ts — desktop runtime, only loaded by `dev/dashboard`
    'ts-md',
    '@craft-native/ts',
    // Project-local resources imported by certain generators. They're a
    // userland concern (top-level pantry.yaml, etc.) and don't belong in
    // the actions package's bundle.
    '*.yaml',
    '*.yml',
  ],

  plugins: [
    dts({
      root: '.',
      outdir: './dist',
    }),
  ],
})

await outro({
  dir: import.meta.dir,
  startTime,
  result,
})
