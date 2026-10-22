import { expect, test } from 'bun:test'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import process from 'node:process'

// stacksjs/stacks#2949: generate:migrations --dialect, and the warning when an
// ordinary generate leaves another dialect's corpus behind. See the fixture.
test('generates another dialect\'s corpus without its database, and reports one left behind', async () => {
  const root = mkdtempSync(join(tmpdir(), 'stacks-other-dialect-'))
  try {
    const config = join(root, 'bunfig.toml')
    writeFileSync(config, 'preload = []\n')
    const child = Bun.spawn([process.execPath, `--config=${config}`, '--no-env-file', `${import.meta.dir}/fixtures/generate-other-dialect.ts`], {
      cwd: root,
      env: { ...process.env, APP_ENV: 'test', DB_CONNECTION: 'sqlite', DB_DATABASE_PATH: join(root, 'app.sqlite'), STACKS_OTHER_DIALECT_ROOT: root },
      stdout: 'pipe',
      stderr: 'pipe',
    })
    const watchdog = setTimeout(() => child.kill(), 80_000)
    try {
      const [code, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()])
      expect(code, `${stdout}\n${stderr}`).toBe(0)
      expect(stdout).toContain('other dialect generation OK')
    }
    finally {
      clearTimeout(watchdog)
      child.kill()
    }
  }
  finally { rmSync(root, { recursive: true, force: true }) }
}, 90_000)
