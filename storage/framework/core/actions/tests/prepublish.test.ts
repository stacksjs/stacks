import { describe, expect, test } from 'bun:test'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

// stacksjs/stacks#3159: prepublish ran a `build:stacks` npm script the
// framework manifest does not have, so it failed before building anything.
async function prepublish(fail = ''): Promise<{ code: number, stdout: string }> {
  const directory = mkdtempSync(join(tmpdir(), 'stacks-prepublish-'))
  try {
    const config = join(directory, 'bunfig.toml')
    writeFileSync(config, 'preload = []\n')
    const child = Bun.spawn([process.execPath, `--config=${config}`, `--preload=${join(import.meta.dir, 'fixtures/recorded-commands.ts')}`, join(import.meta.dir, '../src/prepublish.ts')], {
      cwd: join(import.meta.dir, '../../../../..'),
      env: { ...process.env, APP_ENV: 'test', PREPUBLISH_FAIL: fail },
      stdout: 'pipe', stderr: 'pipe',
    })
    const watchdog = setTimeout(() => child.kill(), 20_000)
    try {
      const [code, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()])
      return { code, stdout: `${stdout}\n${stderr}` }
    }
    finally { clearTimeout(watchdog) }
  }
  finally { rmSync(directory, { recursive: true, force: true }) }
}

describe('prepublish', () => {
  test('builds the CLI and then the core packages, as build:stacks does', async () => {
    const { code, stdout } = await prepublish()
    expect(code, stdout).toBe(0)
    const ran = stdout.split('\n').filter(line => line.startsWith('ran '))
    expect(ran).toEqual([
      'ran bun storage/framework/core/actions/src/build/cli.ts',
      'ran bun storage/framework/core/actions/src/build/core.ts',
    ])
  }, 25_000)

  test('a failed build stops it with a non-zero exit', async () => {
    const { code, stdout } = await prepublish('build/core.ts')
    expect(code, stdout).toBe(1)
    expect(stdout).toContain('The core packages build failed')
  }, 25_000)
})
