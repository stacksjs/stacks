import { afterEach, describe, expect, test } from 'bun:test'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { assertCurrentDeploymentRevision, assertNotBehindLiveRelease, automatedDeploymentRevision, liveReleasesCommand } from '../src/deployment-revision'

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
    const second = git(['rev-parse', 'HEAD'], checkout)
    git(['checkout', '--detach', first], checkout)
    // Behind the head but on the branch: allowed here, with what came after it.
    expect((await assertCurrentDeploymentRevision(revision, checkout))?.newer).toEqual([second])
    // A commit force-pushed off the branch is refused.
    git(['checkout', '-B', 'rewrite', first], checkout)
    writeFileSync(join(checkout, 'file'), 'rewritten')
    git(['commit', '-am', 'rewritten'], checkout)
    const rewritten = git(['rev-parse', 'HEAD'], checkout)
    git(['push', '--force', 'origin', `${first}:refs/heads/main`], checkout)
    git(['push', '--force', 'origin', 'rewrite:refs/heads/main'], checkout)
    git(['checkout', '--detach', second], checkout)
    expect(rewritten).not.toBe(second)
    await expect(assertCurrentDeploymentRevision({ ...revision, sha: second }, checkout)).rejects.toThrow('no longer on the origin branch')
    git(['remote', 'set-url', 'origin', join(root, 'absent.git')], checkout)
    await expect(assertCurrentDeploymentRevision({ ...revision, sha: second }, checkout)).rejects.toThrow('Cannot verify')
    await expect(assertCurrentDeploymentRevision({ ...revision, sha: second, ref: 'refs/heads/invalid ref' }, checkout)).rejects.toThrow('Cannot verify')
  })

  test('a shallow CI checkout learns the commits after it from origin', async () => {
    const root = mkdtempSync(join(tmpdir(), 'stacks-deploy-revision-'))
    directories.push(root)
    const remote = join(root, 'origin.git')
    const author = join(root, 'author')
    const git = (args: string[], cwd = root): string => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()
    git(['init', '--bare', remote])
    git(['init', '-b', 'main', author])
    git(['config', 'user.name', 'Revision fixture'], author)
    git(['config', 'user.email', 'fixture@example.invalid'], author)
    git(['remote', 'add', 'origin', remote], author)
    for (const n of ['one', 'two', 'three']) {
      writeFileSync(join(author, 'file'), n)
      git(['add', 'file'], author)
      git(['commit', '-m', n], author)
    }
    git(['push', 'origin', 'main'], author)
    const ci = git(['rev-parse', 'HEAD'], author)
    // What a CI runner holds: one commit, no history.
    const checkout = join(root, 'ci')
    git(['clone', '--depth', '1', '--branch', 'main', `file://${remote}`, checkout])
    // Two more pushes while CI ran.
    const later: string[] = []
    for (const n of ['four', 'five']) {
      writeFileSync(join(author, 'file'), n)
      git(['commit', '-am', n], author)
      later.unshift(git(['rev-parse', 'HEAD'], author))
    }
    git(['push', 'origin', 'main'], author)
    const check = await assertCurrentDeploymentRevision({ ref: 'refs/heads/main', sha: ci }, checkout)
    expect(check?.newer).toEqual(later)
    // Completing history must not change which commit the runner checked out.
    expect(git(['rev-parse', 'HEAD'], checkout)).toBe(ci)
  })

  // Real Git ancestry and the public guard catch shallow negative-history errors, not live provider/SSH behavior.
  test('a shallow merge excludes an older shared live ancestor and still refuses the newly merged side release', async () => {
    const root = mkdtempSync(join(tmpdir(), 'stacks-deploy-revision-'))
    directories.push(root)
    const remote = join(root, 'origin.git'), author = join(root, 'author'), checkout = join(root, 'ci')
    const git = (args: string[], cwd = root): string => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()
    git(['init', '--bare', remote])
    git(['init', '-b', 'main', author])
    git(['config', 'user.name', 'Revision fixture'], author)
    git(['config', 'user.email', 'fixture@example.invalid'], author)
    git(['remote', 'add', 'origin', remote], author)
    writeFileSync(join(author, 'base'), 'older live release')
    git(['add', 'base'], author)
    git(['commit', '-m', 'older live release'], author)
    const older = git(['rev-parse', 'HEAD'], author)
    writeFileSync(join(author, 'ci'), 'CI revision')
    git(['add', 'ci'], author)
    git(['commit', '-m', 'CI revision'], author)
    const ci = git(['rev-parse', 'HEAD'], author)
    git(['push', 'origin', 'main'], author)
    git(['clone', '--depth', '1', '--branch', 'main', `file://${remote}`, checkout])
    git(['checkout', '-b', 'side', older], author)
    writeFileSync(join(author, 'side'), 'new side release')
    git(['add', 'side'], author)
    git(['commit', '-m', 'new side release'], author)
    const side = git(['rev-parse', 'HEAD'], author)
    git(['checkout', 'main'], author)
    git(['merge', '--no-ff', 'side', '-m', 'merge after CI'], author)
    const merge = git(['rev-parse', 'HEAD'], author)
    git(['push', 'origin', 'main'], author)
    const check = await assertCurrentDeploymentRevision({ ref: 'refs/heads/main', sha: ci }, checkout)
    expect(git(['merge-base', '--is-ancestor', older, ci], author)).toBe('')
    expect(check?.newer).toEqual([merge, side])
    expect(() => assertNotBehindLiveRelease(check, [older.slice(0, 7)])).not.toThrow()
    expect(() => assertNotBehindLiveRelease(check, [ci.slice(0, 7)])).not.toThrow()
    expect(() => assertNotBehindLiveRelease(check, [side.slice(0, 7)])).toThrow('newer than this CI commit')
    expect(() => assertNotBehindLiveRelease(check, [merge.slice(0, 7)])).toThrow('newer than this CI commit')
    expect(git(['rev-parse', 'HEAD'], checkout)).toBe(ci)
  })

  test('fails closed when a shallow origin cannot provide the complete exclusion history', async () => {
    const root = mkdtempSync(join(tmpdir(), 'stacks-deploy-revision-'))
    directories.push(root)
    const remote = join(root, 'origin.git'), author = join(root, 'author'), checkout = join(root, 'ci')
    const shallowOrigin = join(root, 'shallow-origin.git')
    const git = (args: string[], cwd = root): string => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()
    git(['init', '--bare', remote])
    git(['init', '-b', 'main', author])
    git(['config', 'user.name', 'Revision fixture'], author)
    git(['config', 'user.email', 'fixture@example.invalid'], author)
    git(['remote', 'add', 'origin', remote], author)
    for (const value of ['older', 'ci']) {
      writeFileSync(join(author, 'file'), value)
      git(['add', 'file'], author)
      git(['commit', '-m', value], author)
    }
    const ci = git(['rev-parse', 'HEAD'], author)
    git(['push', 'origin', 'main'], author)
    git(['clone', '--depth', '1', '--branch', 'main', `file://${remote}`, checkout])
    writeFileSync(join(author, 'file'), 'newer')
    git(['commit', '-am', 'newer'], author)
    git(['push', 'origin', 'main'], author)
    git(['clone', '--bare', '--depth', '2', '--branch', 'main', `file://${remote}`, shallowOrigin])
    git(['remote', 'set-url', 'origin', `file://${shallowOrigin}`], checkout)
    await expect(assertCurrentDeploymentRevision({ ref: 'refs/heads/main', sha: ci }, checkout)).rejects.toThrow('Cannot verify')
    expect(git(['rev-parse', 'HEAD'], checkout)).toBe(ci)
  })

  test('and one that already held the head as a separate shallow root completes the joining history', async () => {
    const root = mkdtempSync(join(tmpdir(), 'stacks-deploy-revision-'))
    directories.push(root)
    const remote = join(root, 'origin.git')
    const author = join(root, 'author')
    const git = (args: string[], cwd = root): string => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()
    git(['init', '--bare', remote])
    git(['init', '-b', 'main', author])
    git(['config', 'user.name', 'Revision fixture'], author)
    git(['config', 'user.email', 'fixture@example.invalid'], author)
    git(['remote', 'add', 'origin', remote], author)
    const commits: string[] = []
    for (const n of ['one', 'two', 'three', 'four', 'five']) {
      writeFileSync(join(author, 'file'), n)
      git(['add', 'file'], author)
      git(['commit', '-m', n], author)
      commits.push(git(['rev-parse', 'HEAD'], author))
    }
    git(['push', 'origin', 'main'], author)
    git(['config', 'uploadpack.allowReachableSHA1InWant', 'true'], remote)
    // The branch cloned one deep, then the older CI commit fetched one deep beside it.
    const checkout = join(root, 'ci')
    git(['clone', '--depth', '1', '--branch', 'main', `file://${remote}`, checkout])
    const ci = commits[1]!
    git(['fetch', '--depth', '1', 'origin', ci], checkout)
    git(['checkout', '--detach', ci], checkout)
    const check = await assertCurrentDeploymentRevision({ ref: 'refs/heads/main', sha: ci }, checkout)
    expect(check?.newer).toEqual([commits[4], commits[3], commits[2]])
  })
})

describe('never deploying backwards', () => {
  const sha = (c: string) => c.repeat(40)
  const check = { revision: { ref: 'refs/heads/main', sha: sha('a') }, newer: [sha('c'), sha('b')] }

  test('refuses when production already runs a commit that came after this one', () => {
    expect(() => assertNotBehindLiveRelease(check, ['bbbbbbb'])).toThrow('Production already runs bbbbbbb')
    expect(() => assertNotBehindLiveRelease(check, ['0123456', sha('c')])).toThrow('newer than this CI commit')
  })

  test('deploys over an older release, a redeploy, an unknown one, or when this is the head', () => {
    expect(() => assertNotBehindLiveRelease(check, ['0123456'])).not.toThrow()
    expect(() => assertNotBehindLiveRelease(check, ['aaaaaaa'])).not.toThrow()
    expect(() => assertNotBehindLiveRelease(check, [])).not.toThrow()
    expect(() => assertNotBehindLiveRelease(check, ['current', 'staging-1'])).not.toThrow()
    expect(() => assertNotBehindLiveRelease({ ...check, newer: [] }, ['bbbbbbb'])).not.toThrow()
    expect(() => assertNotBehindLiveRelease(undefined, ['bbbbbbb'])).not.toThrow()
  })

  test('reads each site\'s current release, and only for a well-formed project slug', () => {
    expect(liveReleasesCommand('training')).toContain('/var/www/training-*/current')
    expect(() => liveReleasesCommand('x; rm -rf /')).toThrow('slug')
  })
})
