import { readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'bun:test'
import { missingRequirements, provisionedEnvironments, resolveDeploymentTarget } from './resolve-target'

describe('push-to-deploy target resolution', () => {
  it('maps main to the only provisioned production target', () => {
    const target = resolveDeploymentTarget('refs/heads/main')
    expect(target?.environment).toBe('production')
    expect(target?.flag).toBe('--prod')
  })

  it('does not imply unprovisioned environments or tag deployments', () => {
    expect(resolveDeploymentTarget('refs/heads/stage')).toBeUndefined()
    expect(resolveDeploymentTarget('refs/heads/dev')).toBeUndefined()
    expect(resolveDeploymentTarget('refs/tags/v1.0.0-beta.1')).toBeUndefined()
  })

  it('rejects any branch that was never provisioned', () => {
    /*
     * #2068 asks that unknown branches be rejected deterministically rather
     * than falling through to something. `stage` and `dev` are the two names
     * that used to be routed, so they are pinned above; these are the ones
     * nobody thought about.
     */
    for (const branch of ['production', 'master', 'release', 'feature/x', 'main-2', 'mainline', ''])
      expect(resolveDeploymentTarget(`refs/heads/${branch}`)).toBeUndefined()
  })

  it('rejects refs that are not branches at all', () => {
    // A PR merge ref and a bare name both reach this function in CI.
    for (const ref of ['refs/pull/42/merge', 'refs/remotes/origin/main', 'main', '', 'refs/heads'])
      expect(resolveDeploymentTarget(ref)).toBeUndefined()
  })

  it('does not deploy a tag that merely lines up with the prefix', () => {
    /*
     * `refs/heads/` is 11 characters, so any ref whose 12th character onward
     * spells `main` slices to `main` once the prefix check is skipped -
     * `refs/tags/xmain` and `refs/pull/1main` both do. Without this case the
     * suite passes with the `startsWith` guard deleted, because every other ref
     * tested here slices to something that is not a branch name anyway.
     */
    for (const ref of ['refs/tags/xmain', 'refs/pull/1main'])
      expect(resolveDeploymentTarget(ref)).toBeUndefined()
  })
})

/**
 * #2068 asks that required credentials be "validated before deployment". The
 * deploy job used to find out inside `buddy deploy`, minutes in, after the
 * release had already been built - and for a missing decryption key the
 * symptom is not an error but every configured value silently being its
 * default.
 */
describe('environment requirements', () => {
  const target = resolveDeploymentTarget('refs/heads/main')!

  it('names what production cannot deploy without', () => {
    expect(target.requires).toContain('DOTENV_PRIVATE_KEY_PRODUCTION')
  })

  it('reports nothing missing when every requirement is set', () => {
    expect(missingRequirements(target, { DOTENV_PRIVATE_KEY_PRODUCTION: 'key' })).toEqual([])
  })

  it('treats an unset secret as missing', () => {
    expect(missingRequirements(target, {})).toEqual(['DOTENV_PRIVATE_KEY_PRODUCTION'])
  })

  it('treats an EMPTY secret as missing, which is how CI exposes an unset one', () => {
    // A GitHub secret that was never set arrives as the empty string rather
    // than being absent, so a `name in env` check passes for a secret nobody
    // configured - which is the exact case this is meant to catch.
    expect(missingRequirements(target, { DOTENV_PRIVATE_KEY_PRODUCTION: '' })).toEqual(['DOTENV_PRIVATE_KEY_PRODUCTION'])
    expect(missingRequirements(target, { DOTENV_PRIVATE_KEY_PRODUCTION: '   ' })).toEqual(['DOTENV_PRIVATE_KEY_PRODUCTION'])
  })

  it('does not require the values the workflow documents as optional', () => {
    // `DEPLOY_SSH_KEY`, `SSH_KNOWN_HOSTS` and the Cloudflare pair each degrade
    // deliberately, and the workflow says so at each. Listing them would turn a
    // documented degradation into a failed deploy.
    for (const optional of ['DEPLOY_SSH_KEY', 'SSH_KNOWN_HOSTS', 'CLOUDFLARE_API_TOKEN', 'CLOUDFLARE_ACCOUNT_ID'])
      expect(target.requires).not.toContain(optional)
  })

  it('gives every provisioned environment a requirement list', () => {
    // A new environment added without one would pass preflight vacuously,
    // which is the failure mode a second environment introduces.
    for (const { branch, target: entry } of provisionedEnvironments()) {
      expect(Array.isArray(entry.requires)).toBeTrue()
      expect(branch.length).toBeGreaterThan(0)
    }
  })
})

describe('runs without the framework preloads (stacksjs/stacks#2414)', () => {
  it('produces its output from its own directory, where bunfig does not apply', async () => {
    /*
     * The CI step used to run this from the repo root, where `bunfig.toml`
     * preloads the env plugin and the framework preloader - for a script whose
     * only import is `node:fs`. That cost 46 seconds in CI and then overflowed
     * the stack after the correct answer had already been printed.
     *
     * Bun reads `$cwd/bunfig.toml` and does not walk up, so running from here
     * loads none of it. This asserts the invocation still works that way,
     * because the fix lives in the workflow rather than in the script.
     */
    const output = join(tmpdir(), `resolve-target-${Date.now()}.txt`)

    const proc = Bun.spawn(['bun', 'resolve-target.ts', '--ref', 'refs/heads/main', '--github-output', output], {
      cwd: new URL('.', import.meta.url).pathname,
      stdout: 'pipe',
      stderr: 'pipe',
    })

    expect(await proc.exited).toBe(0)

    const stdout = await new Response(proc.stdout).text()
    expect(JSON.parse(stdout.trim())).toEqual({ ref: 'refs/heads/main', environment: 'production', flag: '--prod' })

    // The framework's env plugin announces itself on stderr; its absence is
    // what makes this fast.
    expect(await new Response(proc.stderr).text()).not.toContain('[env]')

    expect(readFileSync(output, 'utf-8')).toBe('environment=production\nflag=--prod\n')
    rmSync(output, { force: true })
  })
})

describe('the preflight invocation', () => {
  const cwd = new URL('.', import.meta.url).pathname

  it('exits non-zero and names the missing value', async () => {
    const proc = Bun.spawn(['bun', 'resolve-target.ts', '--ref', 'refs/heads/main', '--preflight'], {
      cwd,
      // A clean environment, so the repository's own .env cannot satisfy it.
      env: { PATH: process.env.PATH ?? '' },
      stdout: 'pipe',
      stderr: 'pipe',
    })

    expect(await proc.exited).not.toBe(0)
    expect(await new Response(proc.stderr).text()).toContain('DOTENV_PRIVATE_KEY_PRODUCTION')
  })

  it('passes when the value is present', async () => {
    const proc = Bun.spawn(['bun', 'resolve-target.ts', '--ref', 'refs/heads/main', '--preflight'], {
      cwd,
      env: { PATH: process.env.PATH ?? '', DOTENV_PRIVATE_KEY_PRODUCTION: 'set' },
      stdout: 'pipe',
      stderr: 'pipe',
    })

    expect(await proc.exited).toBe(0)
    expect(await new Response(proc.stdout).text()).toContain('all 1 required value(s) present')
  })
})
