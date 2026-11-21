import { describe, expect, it } from 'bun:test'
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
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

  for (const flags of [[], ['--isolate'], ['--parallel=2']]) {
    it(`removes the home when bun test finishes ${flags.join(' ') || 'normally'}`, async () => {
      const root = mkdtempSync(join(tmpdir(), 'stacks-test-lifecycle-'))
      try {
        const files = join(root, 'storage/framework')
        mkdirSync(files, { recursive: true })
        writeFileSync(join(root, 'preload.ts'), `import { bootTestEnvironment } from ${JSON.stringify(feature)}; await bootTestEnvironment()`)
        for (const file of ['first.test.ts', 'second.test.ts']) {
          writeFileSync(join(files, file), `
            import { expect, test } from 'bun:test'
            import { existsSync } from 'node:fs'
            test('the isolated home is available throughout the test', () => {
              expect(process.env.STACKS_HOME).toBeTruthy()
              expect(existsSync(process.env.STACKS_HOME!)).toBe(true)
            })
          `)
        }
        const { STACKS_HOME: _ignored, ...env } = process.env
        const result = Bun.spawnSync([process.execPath, 'test', '--preload', './preload.ts', ...flags], {
          cwd: root,
          env: { ...env, TMPDIR: root },
        })
        expect(result.exitCode, result.stderr.toString()).toBe(0)
        expect(readdirSync(root).filter(name => name.startsWith('stacks-home-'))).toEqual([])
      }
      finally {
        rmSync(root, { recursive: true, force: true })
      }
    })
  }
})
