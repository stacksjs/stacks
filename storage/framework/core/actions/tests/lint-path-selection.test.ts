/**
 * Which files `buddy lint <path>` opens.
 *
 * `lint` and `lint:fix` used to accept positional paths, discard them and run
 * over the whole project. For the read-only `lint` that only wasted time; for
 * `lint:fix` it rewrote files the caller never named, and the reporter of
 * stacksjs/stacks#2953 got 43 modified files from naming one. The caller
 * believed they had scoped the change and the working tree said otherwise.
 *
 * So the invariant under test is narrowness, and the other half is that a path
 * matching nothing is an error: falling back to the whole project is the one
 * behaviour that leads to an accidental commit.
 */
import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { execSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { selectLintableFiles } from '../src/lint/lint'

let repo: string

function write(relative: string, contents = 'export const x = 1\n'): void {
  const full = join(repo, relative)
  mkdirSync(join(full, '..'), { recursive: true })
  writeFileSync(full, contents)
}

beforeEach(() => {
  repo = mkdtempSync(join(tmpdir(), 'lint-paths-'))
  execSync('git init -q', { cwd: repo, stdio: 'ignore' })
  execSync('git config user.email test@example.com', { cwd: repo, stdio: 'ignore' })
  execSync('git config user.name test', { cwd: repo, stdio: 'ignore' })
  write('app/Jobs/Send.ts')
  write('app/Jobs/Prune.ts')
  write('app/Models/User.ts')
  write('docs/readme.md')
  write('resources/views/home.stx', '<template><div /></template>\n')
  write('bun.lock', '{}\n')
  write('.gitignore', 'ignored/\n')
  write('ignored/secret.ts')
})

afterEach(() => {
  rmSync(repo, { recursive: true, force: true })
})

describe('selectLintableFiles', () => {
  test('a named directory selects only what is inside it', () => {
    expect(selectLintableFiles(repo, ['app/Jobs'])).toEqual([
      'app/Jobs/Prune.ts',
      'app/Jobs/Send.ts',
    ])
  })

  test('a named file selects only that file', () => {
    expect(selectLintableFiles(repo, ['app/Models/User.ts'])).toEqual(['app/Models/User.ts'])
  })

  test('several paths union, and a file named twice appears once', () => {
    expect(selectLintableFiles(repo, ['app/Jobs', 'docs', 'app/Jobs/Send.ts'])).toEqual([
      'app/Jobs/Prune.ts',
      'app/Jobs/Send.ts',
      'docs/readme.md',
    ])
  })

  test('a trailing slash and a leading ./ name the same directory', () => {
    const plain = selectLintableFiles(repo, ['app/Jobs'])
    expect(selectLintableFiles(repo, ['app/Jobs/'])).toEqual(plain)
    expect(selectLintableFiles(repo, ['./app/Jobs'])).toEqual(plain)
  })

  test('an absolute path inside the project is accepted', () => {
    expect(selectLintableFiles(repo, [join(repo, 'app/Models/User.ts')])).toEqual(['app/Models/User.ts'])
  })

  test('the project root, named explicitly, is every lintable file', () => {
    expect(selectLintableFiles(repo, ['.'])).toEqual([
      'app/Jobs/Prune.ts',
      'app/Jobs/Send.ts',
      'app/Models/User.ts',
      'docs/readme.md',
      'resources/views/home.stx',
    ])
  })

  test('a directory sibling with a shared name prefix is not swept in', () => {
    // `app/Jobs` must not match `app/JobsArchive`, which a bare
    // startsWith on the path would.
    write('app/JobsArchive/Old.ts')
    expect(selectLintableFiles(repo, ['app/Jobs'])).toEqual([
      'app/Jobs/Prune.ts',
      'app/Jobs/Send.ts',
    ])
  })

  describe('a path that matches nothing is refused, never widened', () => {
    test('a path that does not exist', () => {
      expect(() => selectLintableFiles(repo, ['app/Nope.ts'])).toThrow(/no such file or directory/)
    })

    test('a file whose type lint does not read', () => {
      expect(() => selectLintableFiles(repo, ['bun.lock'])).toThrow(/handles \.ts, \.js, \.stx/)
    })

    test('a file .gitignore excludes', () => {
      expect(() => selectLintableFiles(repo, ['ignored/secret.ts'])).toThrow(/\.gitignore excludes it/)
    })

    test('a path outside the project', () => {
      expect(() => selectLintableFiles(repo, ['../elsewhere'])).toThrow(/outside the project/)
    })

    test('one bad path refuses the whole call, rather than linting the good ones', () => {
      expect(() => selectLintableFiles(repo, ['app/Jobs', 'app/Nope.ts'])).toThrow(/no such file or directory/)
    })
  })
})
