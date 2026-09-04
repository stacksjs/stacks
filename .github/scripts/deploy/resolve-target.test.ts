import { readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'bun:test'
import { resolveDeploymentTarget } from './resolve-target'

describe('push-to-deploy target resolution', () => {
  it('maps main to the only provisioned production target', () => {
    expect(resolveDeploymentTarget('refs/heads/main')).toEqual({ environment: 'production', flag: '--prod' })
  })

  it('does not imply unprovisioned environments or tag deployments', () => {
    expect(resolveDeploymentTarget('refs/heads/stage')).toBeUndefined()
    expect(resolveDeploymentTarget('refs/heads/dev')).toBeUndefined()
    expect(resolveDeploymentTarget('refs/tags/v1.0.0-beta.1')).toBeUndefined()
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
