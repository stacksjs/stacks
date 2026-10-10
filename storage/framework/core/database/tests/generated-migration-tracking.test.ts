import { expect, test } from 'bun:test'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

// Run real generation in a disposable app, never in the framework's corpus.
test('generation, no-op repair and regeneration keep ignored schema visible without staging SQL', async () => {
  const root = await mkdtemp(join(tmpdir(), 'stacks-generated-tracking-'))
  try {
    const config = join(root, 'bunfig.toml')
    await writeFile(config, 'preload = []\n')
    const child = Bun.spawn([process.execPath, `--config=${config}`, '--no-env-file', `${import.meta.dir}/fixtures/generated-migration-tracking.ts`], {
      cwd: root,
      env: { ...process.env, APP_ENV: 'test', DB_CONNECTION: 'sqlite', DB_DATABASE_PATH: join(root, 'app.sqlite'), STACKS_GENERATED_TRACKING_ROOT: root },
      stdout: 'pipe', stderr: 'pipe',
    })
    const watchdog = setTimeout(() => child.kill(), 25000)
    try {
      const [code, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()])
      expect(code, `${stdout}\n${stderr}`).toBe(0)
      expect(stdout).toContain('generated migration tracking OK')
    }
    finally { clearTimeout(watchdog); child.kill() }
  }
  finally { await rm(root, { recursive: true, force: true }) }
}, 30_000)
