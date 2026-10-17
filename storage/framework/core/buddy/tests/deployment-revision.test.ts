import { afterEach, describe, expect, test } from 'bun:test'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { assertCurrentDeploymentRevision, automatedDeploymentRevision } from '../src/deployment-revision'

const directories: string[] = []
afterEach(() => {
  for (const directory of directories.splice(0))
    rmSync(directory, { recursive: true, force: true })
})

describe('automated production revision', () => {
  test('uses actual provider metadata and leaves manual deployments and previews alone', () => {
    const sha = 'a'.repeat(40)
    expect(automatedDeploymentRevision('production', { CI: 'true' })).toBeUndefined()
    expect(automatedDeploymentRevision('staging', { GITHUB_ACTIONS: 'true' })).toBeUndefined()
    expect(automatedDeploymentRevision('production', { GITHUB_ACTIONS: 'true', GITHUB_REF: 'refs/heads/main', GITHUB_SHA: sha })).toEqual({ ref: 'refs/heads/main', sha })
    expect(automatedDeploymentRevision('production', { REVIEWOS: 'true', REVIEWOS_REF: 'refs/heads/main', REVIEWOS_SHA: sha })).toEqual({ ref: 'refs/heads/main', sha })
    for (const ref of [undefined, 'refs/tags/v1', 'refs/pull/1/merge'])
      expect(() => automatedDeploymentRevision('production', { GITHUB_ACTIONS: 'true', GITHUB_REF: ref, GITHUB_SHA: sha })).toThrow('branch ref')
    expect(() => automatedDeploymentRevision('production', { REVIEWOS: 'true', REVIEWOS_REF: 'refs/heads/main', REVIEWOS_SHA: 'abc' })).toThrow('full commit SHA')
  })

  test('checks fresh origin state, rejects checkout mismatch and fails closed when origin is unavailable', async () => {
    const root = mkdtempSync(join(tmpdir(), 'stacks-deploy-revision-'))
    directories.push(root)
    const remote = join(root, 'origin.git')
    const checkout = join(root, 'checkout')
    const git = (args: string[], cwd = root): string => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()
    git(['init', '--bare', remote])
    git(['init', '-b', 'main', checkout])
    git(['config', 'user.name', 'Revision fixture'], checkout)
    git(['config', 'user.email', 'fixture@example.invalid'], checkout)
    git(['remote', 'add', 'origin', remote], checkout)
    writeFileSync(join(checkout, 'file'), 'first')
    git(['add', 'file'], checkout)
    git(['commit', '-m', 'first'], checkout)
    const first = git(['rev-parse', 'HEAD'], checkout)
    git(['push', 'origin', 'main'], checkout)
    const revision = { ref: 'refs/heads/main', sha: first }
    await assertCurrentDeploymentRevision(revision, checkout)
    writeFileSync(join(checkout, 'file'), 'second')
    git(['commit', '-am', 'second'], checkout)
    await expect(assertCurrentDeploymentRevision(revision, checkout)).rejects.toThrow('checkout does not match')
    git(['push', 'origin', 'main'], checkout)
    git(['checkout', '--detach', first], checkout)
    await expect(assertCurrentDeploymentRevision(revision, checkout)).rejects.toThrow('no longer the origin branch head')
    git(['remote', 'set-url', 'origin', join(root, 'absent.git')], checkout)
    await expect(assertCurrentDeploymentRevision(revision, checkout)).rejects.toThrow('Cannot verify')
    await expect(assertCurrentDeploymentRevision({ ...revision, ref: 'refs/heads/invalid ref' }, checkout)).rejects.toThrow('Cannot verify')
  })
})
