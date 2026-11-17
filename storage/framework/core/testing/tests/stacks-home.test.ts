import { describe, expect, it } from 'bun:test'
import { existsSync } from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { join } from 'node:path'
import process from 'node:process'

const feature = new URL('../src/feature.ts', import.meta.url).href

/** Run `setupTestEnvironment` in a fresh process, which is how a test run gets it. */
async function inFreshProcess(env: Record<string, string | undefined>): Promise<{ home: string, removed: boolean }> {
  const child = Bun.spawn([process.execPath, '-e', `
    const { setupTestEnvironment } = await import(${JSON.stringify(feature)})
    setupTestEnvironment()
    console.log(process.env.STACKS_HOME)
  `], { env: env as Record<string, string>, stdout: 'pipe', stderr: 'pipe' })
  const [stdout, stderr, code] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited])
  expect(code, stderr).toBe(0)
  const home = stdout.trim()
  return { home, removed: !existsSync(home) }
}

describe('the machine state a test run sees', () => {
  it('is a directory of its own, removed when the run ends', async () => {
    const { STACKS_HOME: _ignored, ...env } = process.env
    const { home, removed } = await inFreshProcess(env)

    expect(home.startsWith(tmpdir())).toBe(true)
    expect(home).not.toBe(join(homedir(), '.stacks'))
    expect(removed).toBe(true)
  })

  it('is the one a run names itself', async () => {
    const named = join(tmpdir(), 'named-stacks-home')
    expect((await inFreshProcess({ ...process.env, STACKS_HOME: named })).home).toBe(named)
  })
})
