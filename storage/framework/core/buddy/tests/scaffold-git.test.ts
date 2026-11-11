// What a generated app's repository holds when `buddy new` finishes.
//
// `buddy new` ran `git init` and stopped, so a new app began as a few hundred
// untracked files (found scaffolding cursio): the first change had nothing to
// be compared with, and the first commit mixed that change with the scaffold.

import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import process from 'node:process'
import { commitScaffold, scaffoldCommitMessage } from '../src/scaffold-git'

const CREATE_COMMAND = join(import.meta.dir, '../src/commands/create.ts')

// A CI runner has no git identity, and the developer's own must not sign a test.
const IDENTITY = {
  GIT_AUTHOR_NAME: 'Scaffold Test',
  GIT_AUTHOR_EMAIL: 'scaffold@example.test',
  GIT_COMMITTER_NAME: 'Scaffold Test',
  GIT_COMMITTER_EMAIL: 'scaffold@example.test',
}

function git(cwd: string, ...args: string[]): string {
  const result = Bun.spawnSync(['git', ...args], { cwd, stdout: 'pipe', stderr: 'pipe' })
  return result.stdout.toString().trim()
}

let app = ''
let previous: Record<string, string | undefined> = {}

beforeEach(() => {
  app = mkdtempSync(join(tmpdir(), 'stacks-scaffold-git-'))
  previous = {}
  for (const [key, value] of Object.entries(IDENTITY)) {
    previous[key] = process.env[key]
    process.env[key] = value
  }
})

afterEach(() => {
  rmSync(app, { recursive: true, force: true })
  for (const [key, value] of Object.entries(previous)) {
    if (value === undefined)
      delete process.env[key]
    else
      process.env[key] = value
  }
})

describe('commitScaffold', () => {
  test('leaves one commit holding the generated app, and a clean tree', () => {
    git(app, 'init')
    writeFileSync(join(app, 'package.json'), '{}')
    writeFileSync(join(app, '.gitignore'), '.env\n')
    writeFileSync(join(app, '.env'), 'APP_KEY=secret')

    expect(commitScaffold(app, 'Cursio')).toBeNull()

    expect(git(app, 'log', '--format=%s').split('\n')).toEqual(['chore: scaffold Cursio with buddy new'])
    expect(git(app, 'status', '--porcelain')).toBe('')
    // What the app ignores stays out of its history.
    expect(git(app, 'ls-files').split('\n').sort()).toEqual(['.gitignore', 'package.json'])
  })

  test('does not add to a repository that already has a history', () => {
    git(app, 'init')
    writeFileSync(join(app, 'README.md'), 'mine')
    git(app, 'add', '--all')
    git(app, 'commit', '--no-verify', '-m', 'chore: mine')
    writeFileSync(join(app, 'package.json'), '{}')

    expect(commitScaffold(app, 'Cursio')).toBe('the repository already has commits')
    expect(git(app, 'log', '--format=%s').split('\n')).toEqual(['chore: mine'])
  })

  test('says so when there is no repository', () => {
    // `GIT_CEILING_DIRECTORIES` keeps git from finding a repository above the
    // temporary directory on a machine whose tmp sits inside one.
    process.env.GIT_CEILING_DIRECTORIES = tmpdir()
    try {
      expect(commitScaffold(app, 'Cursio')).toBe('not a git repository')
    }
    finally {
      delete process.env.GIT_CEILING_DIRECTORIES
    }
  })

  test('the subject is a conventional commit', () => {
    expect(scaffoldCommitMessage('My App')).toMatch(/^chore: \S/)
  })
})

describe('buddy new wiring', () => {
  const source = readFileSync(CREATE_COMMAND, 'utf8')

  test('commits only a repository it created itself', () => {
    // Booleans, so a failure does not print the whole command.
    expect(source.includes('const createdRepository = !existsSync(resolve(path, \'.git\'))')).toBe(true)
    expect(/if \(createdRepository\)\s+recordScaffold\(path\)/.test(source)).toBe(true)
  })

  test('commits after everything that writes files', () => {
    // Auto-import barrels and the desktop app are the last things written.
    const commit = source.indexOf('recordScaffold(path)')
    expect(commit).toBeGreaterThan(source.indexOf('await regenerateAutoImports(path, options)'))
    expect(commit).toBeGreaterThan(source.indexOf('scaffoldDesktopApp(path, appIdentity(path))'))
  })
})
