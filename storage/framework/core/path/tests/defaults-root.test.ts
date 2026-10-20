import { expect, it } from 'bun:test'
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

/**
 * A new app no longer vendors `storage/framework/defaults`: the same files are
 * in the installed `@stacksjs/defaults`. Every caller that names the tree
 * through `storagePath` / `frameworkPath` has to land there instead, or the
 * first default middleware, model or view it looks up is missing.
 */
function project(vendored: boolean): string {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'stacks-defaults-root-')))
  mkdirSync(join(root, 'storage/framework'), { recursive: true })
  writeFileSync(join(root, 'package.json'), '{"name":"app"}')
  const pkg = join(root, 'node_modules/@stacksjs/defaults')
  mkdirSync(join(pkg, 'app/Models'), { recursive: true })
  writeFileSync(join(pkg, 'package.json'), '{"name":"@stacksjs/defaults","version":"1.0.0"}')
  if (vendored)
    mkdirSync(join(root, 'storage/framework/defaults/app/Models'), { recursive: true })
  return root
}

function resolveIn(cwd: string): Record<string, unknown> {
  // A child process, so the chdir and the per-root memo stay out of this one.
  const source = new URL('../src/index.ts', import.meta.url).href
  const result = Bun.spawnSync([process.execPath, '-e', `
    const { storagePath, frameworkPath, defaultsAppPath, frameworkDefaultsRoot, usesVendoredDefaults } = await import(${JSON.stringify(source)})
    console.log(JSON.stringify({
      models: storagePath('framework/defaults/app/Models'),
      glob: storagePath('framework/defaults/app/Models/**/*.ts'),
      root: frameworkPath('defaults'),
      app: defaultsAppPath('Middleware/Csrf.ts'),
      logs: storagePath('logs'),
      core: frameworkPath('core/path'),
      defaultsRoot: frameworkDefaultsRoot(),
      vendored: usesVendoredDefaults(),
    }))
  `], { cwd, stdout: 'pipe', stderr: 'pipe' })

  if (result.exitCode !== 0)
    throw new Error(result.stderr.toString())

  return JSON.parse(result.stdout.toString())
}

it('resolves the defaults tree from the installed package when the app does not vendor it', () => {
  const root = project(false)
  try {
    const pkg = join(root, 'node_modules/@stacksjs/defaults')
    expect(resolveIn(root)).toEqual({
      models: join(pkg, 'app/Models'),
      glob: join(pkg, 'app/Models/**/*.ts'),
      root: pkg,
      app: join(pkg, 'app/Middleware/Csrf.ts'),
      // Only the defaults tree moves; the rest of storage stays the app's.
      logs: join(root, 'storage/logs'),
      core: join(root, 'storage/framework/core/path'),
      defaultsRoot: pkg,
      vendored: false,
    })
  }
  finally {
    rmSync(root, { recursive: true, force: true })
  }
})

it('keeps a vendored tree in front of the package, as before', () => {
  const root = project(true)
  try {
    const vendored = join(root, 'storage/framework/defaults')
    const resolved = resolveIn(root)
    expect(resolved.models).toBe(join(vendored, 'app/Models'))
    expect(resolved.root).toBe(vendored)
    expect(resolved.vendored).toBe(true)
  }
  finally {
    rmSync(root, { recursive: true, force: true })
  }
})

it('reports the vendored path when neither tree exists', () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'stacks-defaults-root-')))
  mkdirSync(join(root, 'storage/framework'), { recursive: true })
  try {
    expect(resolveIn(root).models).toBe(join(root, 'storage/framework/defaults/app/Models'))
  }
  finally {
    rmSync(root, { recursive: true, force: true })
  }
})

it('links the installed package into storage/framework/defaults, and leaves a vendored tree alone', async () => {
  const { linkPackagedDefaults, usesVendoredDefaults, inspectDefaultsProvenance } = await import('../src/index')
  const { lstatSync, readlinkSync, symlinkSync } = await import('node:fs')

  const root = project(false)
  const vendoredRoot = project(true)
  try {
    const link = join(root, 'storage/framework/defaults')
    expect(linkPackagedDefaults(root)).toBe(true)
    expect(lstatSync(link).isSymbolicLink()).toBe(true)
    // Relative, so the project can move without the link breaking.
    expect(readlinkSync(link)).toBe('../../node_modules/@stacksjs/defaults')
    expect(usesVendoredDefaults(root)).toBe(false)
    expect(inspectDefaultsProvenance(root).status).toBe('not-applicable')
    // Already in place: nothing to do.
    expect(linkPackagedDefaults(root)).toBe(false)

    // A link left dangling by a moved node_modules is replaced.
    rmSync(link)
    symlinkSync('../../nowhere', link, 'dir')
    expect(linkPackagedDefaults(root)).toBe(true)
    expect(readlinkSync(link)).toBe('../../node_modules/@stacksjs/defaults')

    expect(linkPackagedDefaults(vendoredRoot)).toBe(false)
    expect(lstatSync(join(vendoredRoot, 'storage/framework/defaults')).isDirectory()).toBe(true)
    expect(usesVendoredDefaults(vendoredRoot)).toBe(true)
  }
  finally {
    rmSync(root, { recursive: true, force: true })
    rmSync(vendoredRoot, { recursive: true, force: true })
  }
})

it('never takes Bun\'s auto-install cache for an installed package', async () => {
  const { isInstalledDefaultsRoot } = await import('../src/project')

  expect(isInstalledDefaultsRoot('/app/node_modules/@stacksjs/defaults')).toBe(true)
  expect(isInstalledDefaultsRoot('/app/pantry/@stacksjs/defaults')).toBe(true)
  expect(isInstalledDefaultsRoot('/Users/me/.bun/install/cache/@stacksjs/defaults@0.75.244@@@1')).toBe(false)
  // CI keeps Bun's cache inside the checkout's pantry directory.
  expect(isInstalledDefaultsRoot('/home/runner/work/stacks/stacks/pantry/install/cache/@stacksjs/defaults@0.75.244@@@1')).toBe(false)
  expect(isInstalledDefaultsRoot('/x/pantry/install/cache/@stacksjs/defaults')).toBe(false)
})
