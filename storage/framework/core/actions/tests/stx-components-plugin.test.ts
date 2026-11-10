/**
 * The shipped stx components plugin, and the precedence it encodes.
 *
 * stx searches a plugin's `components` list in order and takes the FIRST
 * match, so this array is the precedence rule for every bare tag in every
 * template the process renders. Verified against real stx resolution:
 * a package-only component resolves from the package, and a component that
 * exists in both the framework defaults and a package resolves from the
 * framework.
 */
import { describe, expect, test } from 'bun:test'
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const pluginFile = resolve(import.meta.dir, '../../../defaults/stx-components-plugin.ts')

describe('the stx components plugin', () => {
  test('offers a list, not a single directory', () => {
    // A single string is what it used to be, and it is what stx accepts too -
    // so this regresses silently rather than failing to compile.
    const source = readFileSync(pluginFile, 'utf8')
    expect(source).toContain('components: [')
  })

  test('puts the framework defaults ahead of any package', () => {
    const source = readFileSync(pluginFile, 'utf8')
    const list = source.slice(source.indexOf('components: ['), source.indexOf('...packageDirs()'))

    const defaults = source.indexOf(`'resources/components'`)
    const packages = source.indexOf('...packageDirs()')

    expect(defaults).toBeGreaterThan(-1)
    expect(packages).toBeGreaterThan(-1)

    // This ordering is the entire guarantee that an installed package is
    // ADDITIVE: it answers for tags nothing else defines, and cannot replace
    // a framework component that templates already render.
    expect(defaults).toBeLessThan(packages)

    // `library` is a package root as well - the installed
    // `@stacksjs/components` ui directory - and comparing only against
    // `packageDirs()` left it unchecked. It sat FIRST for a long time, so for
    // the 16 names present in both trees the package answered, and this test
    // passed the whole time. `<EmptyState>` was the visible one: the
    // framework's takes an Iconify class, the package's takes raw SVG, so ten
    // dashboard components printed the class name as text.
    // See stacksjs/stacks#2927.
    const libraryEntry = list.search(/^\s*library,\s*$/m)
    expect(libraryEntry).toBeGreaterThan(-1)
    expect(list.indexOf(`'resources/components'`)).toBeLessThan(libraryEntry)
  })

  test('survives package resolution failing', () => {
    // stx wraps plugin loading in its own try/catch, so an exception raised
    // while resolving package directories would drop the WHOLE plugin - and
    // this plugin supplies the dashboard sidebar. The failure has to be
    // contained here, degrading to "no package components".
    const source = readFileSync(pluginFile, 'utf8')
    const fn = source.slice(source.indexOf('function packageDirs'))

    expect(fn.slice(0, fn.indexOf('}\n'))).toContain('try {')
    expect(fn).toContain('return []')
  })

  test('loads, and reports directories that exist', async () => {
    const plugin = (await import(pluginFile)).default

    // Its own name: `@stacksjs/components` is the library's, and stx gives a
    // plugin with that name the library's role on native screens (#3213).
    expect(plugin.name).toBe('@stacksjs/defaults/components')
    expect(Array.isArray(plugin.components)).toBe(true)
    // The library and the framework defaults, at minimum. Package entries
    // depend on what is installed, so they are not asserted here.
    expect(plugin.components.length).toBeGreaterThanOrEqual(2)
    expect(plugin.components).toContain('resources/components')
  })
})


test('the app keeps installed templates with the controllers it imports', () => {
  const project = realpathSync(mkdtempSync(join(tmpdir(), 'stacks-component-cohort-')))
  const packageRoot = join(project, 'node_modules/@stacksjs/components')
  const installed = join(packageRoot, 'src/ui')
  try {
    mkdirSync(installed, { recursive: true })
    writeFileSync(join(installed, 'PackageOnly.stx'), '<p>Installed component cohort</p>')
    mkdirSync(join(packageRoot, 'dist'), { recursive: true })
    writeFileSync(join(packageRoot, 'package.json'), JSON.stringify({ name: '@stacksjs/components', type: 'module', exports: { './chat': './dist/chat.js' } }))
    writeFileSync(join(packageRoot, 'dist/chat.js'), "export const controllerVersion = 'Installed component cohort'")
    const child = Bun.spawnSync([process.execPath, '--no-env-file', '--eval',
      `import plugin from ${JSON.stringify(pluginFile)}; import { controllerVersion } from '@stacksjs/components/chat'; console.log(JSON.stringify({ library: plugin.components[1], controllerVersion }))`,
    ], { cwd: project, env: { ...process.env, STX_COMPONENTS_DIR: undefined }, stdout: 'pipe', stderr: 'pipe' })
    expect(child.exitCode).toBe(0)
    const result = JSON.parse(child.stdout.toString().trim().split('\n').at(-1)!)
    expect(result.library).toBe(installed)
    expect(readFileSync(join(result.library, 'PackageOnly.stx'), 'utf8')).toBe(`<p>${result.controllerVersion}</p>`)
    const explicit = join(project, 'explicit-ui')
    mkdirSync(explicit)
    const override = Bun.spawnSync([process.execPath, '--no-env-file', '--eval',
      `import plugin from ${JSON.stringify(pluginFile)}; console.log(JSON.stringify({ library: plugin.components[1] }))`,
    ], { cwd: project, env: { ...process.env, STX_COMPONENTS_DIR: explicit }, stdout: 'pipe', stderr: 'pipe' })
    expect(override.exitCode).toBe(0)
    expect(JSON.parse(override.stdout.toString().trim().split('\n').at(-1)!).library).toBe(explicit)
  }
  finally { rmSync(project, { recursive: true, force: true }) }
})

/**
 * On a native screen the shared names resolve to the library's native-safe
 * component, not the framework's web one (stacksjs/stacks#3213). In its own
 * process: stx keeps resolution state per process, and an earlier compile in
 * the same one decided a later one's answer while this was being diagnosed.
 */
test('a native <Button> resolves to the library, through the real plugin', () => {
  const child = Bun.spawnSync([process.execPath, resolve(import.meta.dir, 'fixtures/native-shared-button.ts'), pluginFile], {
    cwd: resolve(import.meta.dir, '../../../../..'),
    stdout: 'pipe',
    stderr: 'pipe',
  })
  const line = child.stdout.toString().trim().split('\n').filter(entry => entry.startsWith('{')).at(-1)
  expect({ code: child.exitCode, error: line ? '' : child.stderr.toString() }).toEqual({ code: 0, error: '' })
  const result = JSON.parse(line!)
  // The library's file; the path may be its realpath in Bun's install cache.
  expect(result.button).toMatch(/@stacksjs\/components[^/]*\/src\/ui\/button\/Button\.stx$/)
  // A client script the native compiler drops by design is the only report.
  expect(result.unrenderable).toEqual([])
  // Control: an app-written name with no shared counterpart still gets the
  // framework's component, diagnostics and all, so the probe sees the host.
  expect(result.avatar).toMatch(/Dashboard\/UI\/Avatar\.stx$/)
  expect(result.avatarUnrenderable).toBeGreaterThan(0)
}, 60_000)
