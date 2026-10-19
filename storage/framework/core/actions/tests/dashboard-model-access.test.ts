import { expect, test } from 'bun:test'
import { mkdtemp, realpath, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { runIsolated } from '../../testing/src/isolated'

// Real Actions and loopback HTTP with native models and a disposable SQLite file; no incident-policy or physical-custody claim.
test('generic dashboard exposure excludes private models without disabling their ORM or named Actions', async () => {
  const project = await realpath(await mkdtemp(join(tmpdir(), 'stacks-dashboard-model-access-')))
  try {
    const result = await runIsolated(join(import.meta.dir, 'fixtures/dashboard-model-access.ts'), {
      cwd: project, preload: [], envFile: false, timeoutMs: 60000,
      env: { APP_ENV: 'test', NODE_ENV: 'test', DB_CONNECTION: 'sqlite', DB_DATABASE_PATH: join(project, 'fixture.sqlite'), STACKS_DASHBOARD_ACCESS_PROJECT: project, STACKS_SKIP_DEFAULT_ROUTES: '1', STACKS_MODEL_APIS: 'PrivateRecord' },
    })
    expect(result.code, `exit=${result.code} signal=${result.signal}\n${result.stdout}\n${result.stderr}`).toBe(0)
    expect(result.stdout).toContain('dashboard model access OK')
  }
  finally { await rm(project, { recursive: true, force: true }) }
}, 65000)
