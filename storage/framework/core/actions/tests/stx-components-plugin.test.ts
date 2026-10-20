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
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

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

    expect(plugin.name).toBe('@stacksjs/components')
    expect(Array.isArray(plugin.components)).toBe(true)
    // The library and the framework defaults, at minimum. Package entries
    // depend on what is installed, so they are not asserted here.
    expect(plugin.components.length).toBeGreaterThanOrEqual(2)
    expect(plugin.components).toContain('resources/components')
  })
})
