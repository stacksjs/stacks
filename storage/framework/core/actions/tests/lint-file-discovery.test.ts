/**
 * Which files `buddy lint` actually opens.
 *
 * This is worth a test because the failure mode is invisible. Discovery used to
 * be `git ls-files`, which lists tracked files only, so a file you had just
 * written was skipped: lint reported a clean project without ever reading it,
 * and CI failed on that same file one commit later, once it was tracked. A lint
 * that ignores exactly the files a commit introduces is worse than no lint,
 * because it is trusted.
 */
import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { execSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { lintableFiles } from '../src/lint/lint'

let repo: string

function write(relative: string, contents = 'export const x = 1\n'): void {
  const full = join(repo, relative)
  mkdirSync(join(full, '..'), { recursive: true })
  writeFileSync(full, contents)
}

function git(command: string): void {
  execSync(`git ${command}`, { cwd: repo, stdio: 'ignore' })
}

beforeEach(() => {
  repo = mkdtempSync(join(tmpdir(), 'lint-discovery-'))
  git('init -q')
  git('config user.email test@example.com')
  git('config user.name test')
})

afterEach(() => {
  rmSync(repo, { recursive: true, force: true })
})

describe('lintableFiles', () => {
  test('includes a file that has never been staged', () => {
    // The regression. A newly written file is the whole point of running lint.
    write('src/fresh.ts')

    expect(lintableFiles(repo)).toContain('src/fresh.ts')
  })

  test('includes tracked files too', () => {
    write('src/committed.ts')
    git('add -A')
    git('commit -qm add')

    expect(lintableFiles(repo)).toContain('src/committed.ts')
  })

  test('lists a tracked file exactly once', () => {
    // `--cached --others` must not report a staged-and-modified file twice, or
    // pickier lints it twice and every finding in it is duplicated.
    write('src/both.ts')
    git('add -A')
    write('src/both.ts', 'export const x = 2\n')

    expect(lintableFiles(repo).filter(file => file === 'src/both.ts')).toHaveLength(1)
  })

  test('respects .gitignore', () => {
    // Without --exclude-standard, an untracked scan walks straight into build
    // output and dependencies, and lint takes minutes instead of seconds.
    write('.gitignore', 'ignored/\n')
    write('ignored/generated.ts')
    write('src/real.ts')

    const files = lintableFiles(repo)
    expect(files).toContain('src/real.ts')
    expect(files).not.toContain('ignored/generated.ts')
  })

  test('skips dependency and build directories even when git would list them', () => {
    write('node_modules/pkg/index.ts')
    write('dist/bundle.js')
    write('src/real.ts')

    const files = lintableFiles(repo)
    expect(files).toContain('src/real.ts')
    expect(files.some(file => file.startsWith('node_modules/'))).toBeFalse()
    expect(files.some(file => file.startsWith('dist/'))).toBeFalse()
  })

  test('only lintable extensions', () => {
    write('src/code.ts')
    write('src/image.png', 'not really a png')
    write('src/styles.css')

    const files = lintableFiles(repo)
    expect(files).toContain('src/code.ts')
    expect(files).not.toContain('src/image.png')
    expect(files).not.toContain('src/styles.css')
  })

  test('a directory that is not a git repository yields nothing rather than throwing', () => {
    const bare = mkdtempSync(join(tmpdir(), 'lint-nogit-'))
    try {
      expect(lintableFiles(bare)).toEqual([])
    }
    finally {
      rmSync(bare, { recursive: true, force: true })
    }
  })
})
