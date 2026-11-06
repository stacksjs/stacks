import { expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * The dev dashboard's STX directory must not sit inside a directory it watches.
 *
 * stx writes bundles and CSS into its directory on every render, and a write
 * under a watched root is treated as a source change: the HMR version bumps
 * and every open page reloads. With STX_DIR inside `framework/runtime/dashboard`,
 * each reload rendered, wrote, bumped and reloaded again, and the kept-page
 * cache never matched its own fingerprint. The manifest the sidebar is built
 * from must stay watched, or a config change would serve an old sidebar
 * (stacksjs/stacks#3035).
 *
 * Read from the code with comments stripped, so prose cannot satisfy it, and
 * required to find every path, so it cannot pass by finding none.
 */
const source = new Bun.Transpiler({ loader: 'ts' }).transformSync(
  readFileSync(resolve(import.meta.dir, '../src/dev/dashboard.ts'), 'utf8'),
)

function storageArg(pattern: RegExp): string {
  const match = source.match(pattern)
  expect(match, `${pattern} not found in dev/dashboard.ts`).not.toBeNull()
  return match![1]!
}

const stxDir = storageArg(/process\.env\.STX_DIR\s*=\s*storagePath\(["']([^"']+)["']\)/)
const manifestPath = storageArg(/manifestPath\s*=\s*storagePath\(["']([^"']+)["']\)/)
const watchBlock = source.match(/watchDirs:\s*\[([\s\S]*?)\]/)?.[1] ?? ''
const watchedStorage = [...watchBlock.matchAll(/storagePath\(["']([^"']+)["']\)/g)].map(m => m[1]!)

const inside = (path: string, root: string) => path === root || path.startsWith(`${root}/`)

test('the watched storage roots are found', () => {
  expect(watchedStorage.length).toBeGreaterThan(0)
})

test('no watched root contains the dashboard STX directory', () => {
  for (const root of watchedStorage)
    expect(inside(stxDir, root), `${stxDir} is inside the watched ${root}`).toBeFalse()
})

test('the models manifest is still inside a watched root', () => {
  expect(watchedStorage.some(root => inside(manifestPath, root))).toBeTrue()
})
