import { afterEach, describe, expect, test } from 'bun:test'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { describeStxCopies, findStxCopies, STX_DECLARED_PACKAGES, STX_PACKAGES } from '../src/stx-copies'

/**
 * `buddy doctor` says whether an app has one copy of STX (stacksjs/stacks#3260).
 *
 * Two versions install cleanly and run, with pages that find no routes or
 * components: hq.training saw exactly that. Apps kept overrides to prevent
 * it. With the framework asking for "this release or newer" they no longer
 * need to, and this is how an app sees that it got one copy.
 */
const roots: string[] = []
afterEach(() => {
  for (const root of roots.splice(0))
    rmSync(root, { recursive: true, force: true })
})

function app(packages: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), 'stacks-stx-copies-'))
  roots.push(root)
  for (const [path, version] of Object.entries(packages)) {
    const dir = join(root, 'node_modules', path)
    mkdirSync(dir, { recursive: true })
    const name = path.split('node_modules/').pop()!
    writeFileSync(join(dir, 'package.json'), JSON.stringify({ name, version }))
  }
  return root
}

describe('the copies of STX an app has installed', () => {
  test('one of each, on one version', () => {
    const root = app({ '@stacksjs/stx': '0.2.851', '@stacksjs/components': '0.2.851', 'bun-plugin-stx': '0.2.851', 'stx-router': '0.2.851', 'left-pad': '1.3.0' })
    expect(findStxCopies(root).map(copy => `${copy.name}@${copy.version}`)).toEqual(['@stacksjs/components@0.2.851', '@stacksjs/stx@0.2.851', 'bun-plugin-stx@0.2.851', 'stx-router@0.2.851'])
    expect(describeStxCopies(findStxCopies(root))).toEqual({ status: 'pass', message: 'one copy, 0.2.851' })
  })

  test('a second copy nested under the package that asked for it', () => {
    // What an exact pin in the framework did to an app on a newer STX.
    const root = app({
      '@stacksjs/stx': '0.2.851',
      'bun-plugin-stx': '0.2.851',
      '@stacksjs/actions/node_modules/@stacksjs/stx': '0.2.842',
      '@stacksjs/actions/node_modules/bun-plugin-stx': '0.2.842',
    })
    expect(findStxCopies(root).map(copy => `${copy.name}@${copy.version} in ${copy.path}`)).toEqual([
      '@stacksjs/stx@0.2.842 in node_modules/@stacksjs/actions/node_modules/@stacksjs/stx',
      '@stacksjs/stx@0.2.851 in node_modules/@stacksjs/stx',
      'bun-plugin-stx@0.2.842 in node_modules/@stacksjs/actions/node_modules/bun-plugin-stx',
      'bun-plugin-stx@0.2.851 in node_modules/bun-plugin-stx',
    ])
    const report = describeStxCopies(findStxCopies(root))!
    expect(report.status).toBe('fail')
    expect(report.message).toContain('2 versions are installed (@stacksjs/stx 0.2.842 and 0.2.851; bun-plugin-stx 0.2.842 and 0.2.851)')
    expect(report.message).toContain('Declare @stacksjs/stx, @stacksjs/components, bun-plugin-stx at one version in package.json, remove any override of them, and reinstall.')
  })

  test('one copy of each, on different versions, is still two runtimes', () => {
    // Raising the runtime and not its components.
    const root = app({ '@stacksjs/stx': '0.2.851', '@stacksjs/components': '0.2.852', 'bun-plugin-stx': '0.2.851' })
    const report = describeStxCopies(findStxCopies(root))!
    expect(report.status).toBe('fail')
    expect(report.message).toContain('@stacksjs/stx 0.2.851; @stacksjs/components 0.2.852; bun-plugin-stx 0.2.851')
  })

  test('the same directory reached twice is one copy', () => {
    // Bun's isolated store links the top-level name at the stored package.
    const root = app({ '.bun/@stacksjs+stx@0.2.851/node_modules/@stacksjs/stx': '0.2.851' })
    mkdirSync(join(root, 'node_modules/@stacksjs'), { recursive: true })
    symlinkSync(join(root, 'node_modules/.bun/@stacksjs+stx@0.2.851/node_modules/@stacksjs/stx'), join(root, 'node_modules/@stacksjs/stx'))
    expect(findStxCopies(root)).toHaveLength(1)
    expect(describeStxCopies(findStxCopies(root))).toEqual({ status: 'pass', message: 'one copy, 0.2.851' })
  })

  test('a package that only shares the name is not counted, and no STX at all is not this check\'s to report', () => {
    const root = app({ 'left-pad': '1.3.0' })
    mkdirSync(join(root, 'node_modules/stx-router'), { recursive: true })
    writeFileSync(join(root, 'node_modules/stx-router/package.json'), JSON.stringify({ name: 'something-else', version: '9.9.9' }))
    expect(findStxCopies(root)).toEqual([])
    expect(describeStxCopies([])).toBeNull()
    expect(findStxCopies(join(root, 'no-such-app'))).toEqual([])
  })
})

describe('where it is used', () => {
  test('buddy doctor reports it', () => {
    const doctor = readFileSync(join(dirname(import.meta.dir), 'src/commands/doctor.ts'), 'utf8')
    expect(doctor).toContain('checks.push({ name: \'STX packages\', ...report })')
  })

  test('this repository itself has one copy', () => {
    const report = describeStxCopies(findStxCopies(join(import.meta.dir, '../../../../..')))
    expect(report?.status).toBe('pass')
  })

  test('the packages named are the ones the scaffold and the upgrade know', () => {
    expect([...STX_PACKAGES].sort()).toEqual(['@stacksjs/components', '@stacksjs/desktop', '@stacksjs/sanitizer', '@stacksjs/stx', 'bun-plugin-stx', 'stx-router'])
    expect(STX_DECLARED_PACKAGES).toEqual(['@stacksjs/stx', '@stacksjs/components', 'bun-plugin-stx'])
  })
})
