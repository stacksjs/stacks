import { expect, it } from 'bun:test'
import { execFileSync } from 'node:child_process'
import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pushIosReleaseTag } from '../src/release-ios'

it('retries the same build after a rejected atomic push without losing the candidate commit', () => {
  const root = mkdtempSync(join(tmpdir(), 'stacks-ios-release-push-'))
  const remote = join(root, 'origin.git')
  const local = join(root, 'app')
  const git = (cwd: string, ...args: string[]) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()
  try {
    git(root, 'init', '--bare', remote)
    git(root, 'clone', remote, local)
    git(local, 'config', 'user.name', 'Release test')
    git(local, 'config', 'user.email', 'release@example.test')
    git(local, 'switch', '-c', 'main')
    git(local, 'commit', '--allow-empty', '-m', 'initial')
    git(local, 'push', 'origin', 'main')
    const previous = git(local, 'rev-parse', 'HEAD')
    git(local, 'commit', '--allow-empty', '-m', 'release candidate')
    const candidate = git(local, 'rev-parse', 'HEAD')
    const hook = join(remote, 'hooks', 'pre-receive')
    mkdirSync(join(remote, 'hooks'), { recursive: true })
    git(remote, 'config', 'core.hooksPath', join(remote, 'hooks'))
    writeFileSync(hook, '#!/bin/sh\nexit 1\n')
    chmodSync(hook, 0o755)
    expect(() => pushIosReleaseTag(local, 'v1.0.0-build.140')).toThrow()
    expect(git(local, 'tag', '--list')).toBe('')
    expect(git(local, 'rev-parse', 'HEAD')).toBe(candidate)
    expect(git(remote, 'rev-parse', 'refs/heads/main')).toBe(previous)
    expect(git(remote, 'tag', '--list')).toBe('')
    rmSync(hook)
    pushIosReleaseTag(local, 'v1.0.0-build.140')
    expect(git(remote, 'rev-parse', 'refs/heads/main')).toBe(candidate)
    expect(git(remote, 'rev-parse', 'v1.0.0-build.140^{commit}')).toBe(candidate)
    expect(() => pushIosReleaseTag(local, 'v1.0.0-build.140')).toThrow()
    expect(git(local, 'rev-parse', 'v1.0.0-build.140^{commit}')).toBe(candidate)
  }
  finally { rmSync(root, { recursive: true, force: true }) }
})
