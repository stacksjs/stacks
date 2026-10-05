/**
 * Every `glob()` option does what it says, and `del()` with a glob deletes.
 *
 * `ignore`, `deep`, `onlyDirectories` and `expandDirectories` were declared
 * and dropped before the scan. The server's auto-import scan asked to skip
 * `index.ts` and `*.d.ts` and got both. `deleteGlob` asked for directories,
 * got files, declined each as "not a directory", and reported success - so
 * `del('dist/*')` deleted nothing.
 */

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { del } from '../src/delete'
import { glob, globSync } from '../src/glob'

let root: string

function touch(...paths: string[]): void {
  for (const path of paths) {
    mkdirSync(join(root, path, '..'), { recursive: true })
    writeFileSync(join(root, path), '')
  }
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'stacks-glob-'))
  touch('Models/User.ts', 'Models/index.ts', 'Models/User.d.ts', 'Models/commerce/Order.ts', 'Models/commerce/deep/Line.ts', 'Models/README.md')
})

afterEach(() => {
  rmSync(root, { recursive: true, force: true })
})

const sorted = (paths: string[]): string[] => [...paths].sort()

describe('glob options', () => {
  test('ignore leaves matches out, whichever form the match takes', async () => {
    const ignore = ['**/*.d.ts', '**/index.ts', '**/README*']
    expect(sorted(globSync('Models/*.ts', { cwd: root, ignore }))).toEqual(['Models/User.ts'])
    // An absolute pattern returns absolute matches; the ignore still applies.
    expect(sorted(await glob(`${root}/Models/**/*.ts`, { ignore }))).toEqual(sorted([
      `${root}/Models/User.ts`,
      `${root}/Models/commerce/Order.ts`,
      `${root}/Models/commerce/deep/Line.ts`,
    ]))
    // Relative to cwd too: a pattern rooted below the ignore.
    expect(globSync('Models/**/*.ts', { cwd: root, ignore: ['Models/commerce/**'] }).some(path => path.includes('commerce'))).toBe(false)
  })

  test('deep limits how far below the pattern base a match may sit', () => {
    expect(sorted(globSync('Models/**/*.ts', { cwd: root, deep: 0 }))).toEqual(['Models/User.d.ts', 'Models/User.ts', 'Models/index.ts'])
    expect(sorted(globSync('Models/**/*.ts', { cwd: root, deep: 1 }))).toEqual(['Models/User.d.ts', 'Models/User.ts', 'Models/commerce/Order.ts', 'Models/index.ts'])
    expect(globSync('Models/**/*.ts', { cwd: root, deep: 1, absolute: true })).toContain(`${root}/Models/commerce/Order.ts`)
  })

  test('onlyDirectories matches directories and nothing else', async () => {
    expect(sorted(await glob('Models/**', { cwd: root, onlyDirectories: true }))).toEqual(['Models/commerce', 'Models/commerce/deep'])
  })

  test('onlyFiles: false matches both', () => {
    expect(sorted(globSync('Models/commerce/*', { cwd: root, onlyFiles: false }))).toEqual(['Models/commerce/Order.ts', 'Models/commerce/deep'])
  })

  test('expandDirectories reads a directory as everything under it', () => {
    expect(sorted(globSync('Models/commerce', { cwd: root, expandDirectories: true }))).toEqual(['Models/commerce/Order.ts', 'Models/commerce/deep/Line.ts'])
    // Off by default: a bare directory names no file.
    expect(globSync('Models/commerce', { cwd: root })).toEqual([])
  })

  test('two overlapping patterns report a match once', () => {
    expect(globSync(['Models/*.ts', 'Models/User*'], { cwd: root }).filter(path => path === 'Models/User.ts')).toHaveLength(1)
  })

  test('a pattern under a missing directory still matches nothing rather than throwing', () => {
    expect(globSync('Nope/**/*.ts', { cwd: root })).toEqual([])
  })
})

describe('del() with a glob', () => {
  test('deletes the files and directories it matches', async () => {
    touch('dist/app.js', 'dist/chunks/a.js', 'dist/.hidden', 'keep.ts')

    const result = await del(`${root}/dist/*`)

    expect(result.isOk).toBe(true)
    expect(globSync('**/*', { cwd: root, onlyFiles: false, dot: true }).filter(path => path.startsWith('dist/'))).toEqual([])
    expect(globSync('keep.ts', { cwd: root })).toEqual(['keep.ts'])
  })

  test('deletes only the files a file pattern names', async () => {
    touch('logs/a.log', 'logs/b.log', 'logs/keep.txt')

    await del(`${root}/logs/*.log`)

    expect(sorted(globSync('logs/*', { cwd: root }))).toEqual(['logs/keep.txt'])
  })

  test('a directory matched along with its contents is deleted once, without error', async () => {
    touch('build/x/one.js', 'build/x/two.js')

    const result = await del(`${root}/build/**`)

    expect(result.isOk).toBe(true)
    expect(globSync('build/**', { cwd: root, onlyFiles: false })).toEqual([])
  })
})
