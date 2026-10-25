import { expect, test } from 'bun:test'
import { mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { runBoundedProcess } from '@stacksjs/cli/process'

for (const mode of ['tag-empty', 'category-empty', 'tag-populated', 'category-populated', 'canonical']) {
  test(`native legacy trait pivot: ${mode}`, async () => {
    const directory = realpathSync(mkdtempSync(join(tmpdir(), 'stacks-trait-pivot-')))
    const config = join(directory, 'bunfig.toml')
    writeFileSync(config, 'preload = []\n')
    let complete = false
    try {
      const result = await runBoundedProcess([process.execPath, `--config=${config}`, '--no-env-file', `${import.meta.dir}/fixtures/trait-pivot-reconciliation.ts`], {
        cwd: directory, env: { ...process.env, APP_ENV: 'test', NODE_ENV: 'test', DB_CONNECTION: 'sqlite', DB_DATABASE_PATH: join(directory, 'fixture.sqlite'), STACKS_TRAIT_FIXTURE_ROOT: directory, STACKS_TRAIT_FIXTURE_MODE: mode },
        timeoutMs: 90_000, stdoutBytes: 2_000_000, stderrBytes: 2_000_000, strictUtf8: true, label: `Native trait pivot ${mode}`,
      })
      writeFileSync(join(directory, 'stdout.log'), result.stdout)
      writeFileSync(join(directory, 'stderr.log'), result.stderr)
      expect(result.exitCode, `${directory}: ${result.stdout}\n${result.stderr}`).toBe(0)
      expect(result.stdout).toContain(`native trait pivot ${mode} OK`)
      complete = true
    }
    finally { if (complete) rmSync(directory, { recursive: true }) }
  }, 100_000)
}
