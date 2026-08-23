/**
 * The vendored defaults must be found from wherever the code is running,
 * including a bundle.
 *
 * `resolveDefaultsRoot()` used to locate the project by counting six `..` from
 * its own file, which is correct for `core/actions/src/dev/` and for nothing
 * else. A deployed Stacks app does not run that file: `config/cloud.ts` builds
 * `core/buddy/src/serve-entry.ts` into a bundle at
 * `storage/framework/runtime/production/serve.js` and starts THAT, four levels
 * under the project root. Six levels up from there is two directories ABOVE the
 * app, `storage/framework/defaults` is not found, and the resolver falls
 * through to the published `@stacksjs/defaults` package.
 *
 * Nothing throws when that happens. The app serves the last release's default
 * views instead of the ones sitting next to it on disk, so any default view,
 * layout or component added since that release is silently missing in
 * production and present everywhere else. stacksjs.com answered 404s with
 * stx's generic page for exactly this reason, while its own
 * `defaults/resources/views/errors/404.stx` was on the box the whole time.
 *
 * Testing this by calling the function from the suite proves nothing: the
 * suite runs at the depth the old arithmetic was written for, so it passes
 * either way. The bundle has to be built and run where production puts it.
 */
import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const resolverSource = join(import.meta.dir, '../src/dev/defaults-resources.ts')

/**
 * A checkout carrying the vendored defaults, with nothing above it.
 *
 * realpath because macOS hands out /var/folders/... while anything resolving
 * the tree reports /private/var/folders/..., and comparing those two fails for
 * a reason that has nothing to do with this bug.
 */
const root = realpathSync(mkdtempSync(join(tmpdir(), 'stacks-defaults-root-')))
const vendored = join(root, 'storage/framework/defaults')

beforeAll(() => {
  mkdirSync(join(vendored, 'resources/views/errors'), { recursive: true })
  writeFileSync(join(vendored, 'resources/views/errors/404.stx'), '<div>not found</div>\n')
})

afterAll(() => rmSync(root, { recursive: true, force: true }))

/**
 * Build the real resolver to `outDir` inside the fixture and run it there,
 * the way `preStart` builds `serve.js` and `start` runs it.
 */
async function resolveFromBundleAt(outDir: string): Promise<string> {
  const dir = join(root, outDir)
  mkdirSync(dir, { recursive: true })

  const entry = join(root, 'entry.ts')
  writeFileSync(entry, `import { resolveDefaultsRoot } from ${JSON.stringify(resolverSource)}\nconsole.log(resolveDefaultsRoot())\n`)

  const built = await Bun.build({
    entrypoints: [entry],
    outdir: dir,
    target: 'bun',
    naming: 'serve.js',
  })
  expect(built.success).toBe(true)

  // cwd deliberately outside the fixture: the answer must come from where the
  // bundle sits, not from where the process happened to start.
  const run = Bun.spawnSync(['bun', join(dir, 'serve.js')], { cwd: tmpdir() })
  return new TextDecoder().decode(run.stdout).trim()
}

describe('resolveDefaultsRoot, from a bundle', () => {
  it('finds the vendored defaults from the production bundle path', async () => {
    // storage/framework/runtime/production: four levels down, the case that
    // was broken. Six `..` from here escapes the fixture entirely.
    expect(await resolveFromBundleAt('storage/framework/runtime/production')).toBe(vendored)
  })

  it('finds them from the source path too, six levels down', async () => {
    expect(await resolveFromBundleAt('storage/framework/core/actions/src/dev')).toBe(vendored)
  })

  it('finds them from the project root, no levels down', async () => {
    expect(await resolveFromBundleAt('.')).toBe(vendored)
  })
})

describe('resolveDefaultsResources in this checkout', () => {
  it('answers with the vendored tree, not the published package', async () => {
    const { resolveDefaultsResources } = await import('../src/dev/defaults-resources')
    const resolved = resolveDefaultsResources()

    expect(resolved.endsWith('storage/framework/defaults/resources')).toBe(true)
    expect(resolved).not.toContain('node_modules')
  })

  it('and carries the default error view, which the published package predates', async () => {
    const { resolveDefaultsResources } = await import('../src/dev/defaults-resources')
    const { existsSync } = await import('node:fs')

    // The concrete file the bug hid. Resolved to node_modules it is absent,
    // which is what production was serving.
    expect(existsSync(join(resolveDefaultsResources(), 'views/errors/404.stx'))).toBe(true)
  })
})
