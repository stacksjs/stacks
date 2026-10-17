import { afterEach, expect, test } from 'bun:test'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { releasePushTarget } from '../src/release-push-target'

const directories: string[] = []
afterEach(() => {
  for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true })
})

function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'stacks-release-target-'))
  directories.push(root)
  const checkout = join(root, 'checkout')
  const remote = join(root, 'origin.git')
  const git = (args: string[], cwd = checkout): string => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()
  git(['init', '--bare', remote], root)
  git(['init', '-b', 'main', checkout], root)
  git(['config', 'user.name', 'Release fixture'])
  git(['config', 'user.email', 'fixture@example.invalid'])
  git(['commit', '--allow-empty', '-m', 'base'])
  git(['remote', 'add', 'origin', remote])
  git(['push', 'origin', 'main'])
  git(['checkout', '-b', 'codex/fixture'])
  return { checkout, remote, git }
}

test('atomically publishes the configured upstream and tag without creating a worktree branch remotely', () => {
  const { checkout, remote, git } = fixture()
  git(['branch', '--set-upstream-to', 'origin/main'])
  git(['commit', '--allow-empty', '-m', 'release'])
  git(['tag', 'v1.0.0'])
  const target = releasePushTarget(checkout)
  expect(target).toEqual({ remote: 'origin', ref: 'refs/heads/main' })
  git(['push', '--atomic', '--', target.remote, `HEAD:${target.ref}`, 'refs/tags/v1.0.0'])
  expect(git(['--git-dir', remote, 'rev-parse', 'refs/heads/main'])).toBe(git(['rev-parse', 'HEAD']))
  expect(git(['--git-dir', remote, 'rev-parse', 'refs/tags/v1.0.0'])).toBe(git(['rev-parse', 'HEAD']))
  expect(git(['--git-dir', remote, 'for-each-ref', '--format=%(refname)', 'refs/heads/'])).toBe('refs/heads/main')
})

test('keeps the current branch for an untracked branch and refuses invalid release destinations', () => {
  const { checkout, git } = fixture()
  expect(releasePushTarget(checkout)).toEqual({ remote: 'origin', ref: 'refs/heads/codex/fixture' })
  git(['config', 'branch.codex/fixture.remote', '.'])
  git(['config', 'branch.codex/fixture.merge', 'refs/heads/main'])
  expect(() => releasePushTarget(checkout)).toThrow('configured remote')
  git(['config', 'branch.codex/fixture.remote', 'origin'])
  git(['config', 'branch.codex/fixture.merge', 'refs/tags/v1'])
  expect(() => releasePushTarget(checkout)).toThrow('single branch')
  git(['config', 'branch.codex/fixture.merge', 'refs/heads/main'])
  git(['config', '--add', 'branch.codex/fixture.merge', 'refs/heads/other'])
  expect(() => releasePushTarget(checkout)).toThrow('single branch')
  git(['config', '--unset-all', 'branch.codex/fixture.merge'])
  expect(() => releasePushTarget(checkout)).toThrow('incomplete upstream')
  git(['checkout', '--detach'])
  expect(() => releasePushTarget(checkout)).toThrow('on a branch')
})
