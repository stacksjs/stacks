import { expect, test } from 'bun:test'
import { join, resolve } from 'node:path'
import process from 'node:process'

interface ProbeResult {
  before: boolean
  after: boolean
  routerRootLoaded: boolean
}

const repositoryRoot = resolve(import.meta.dir, '../../../../..')
const config = join(repositoryRoot, 'bench/startup/bunfig.toml')
const fixture = join(import.meta.dir, 'fixtures/import-probe.ts')

test('server import keeps the full logger and router root unloaded', () => {
  const child = Bun.spawnSync([
    process.execPath,
    '--no-env-file',
    `--config=${config}`,
    fixture,
  ], {
    cwd: repositoryRoot,
    env: {
      ...process.env,
      LOG_WRITE_TO_FILE: 'false',
      SKIP_CONFIG_LOADING: 'true',
    },
  })

  expect(child.exitCode).toBe(0)
  const lines = child.stdout.toString().trim().split('\n')
  expect(JSON.parse(lines.at(-1)!)).toEqual({
    before: false,
    after: false,
    routerRootLoaded: false,
  } satisfies ProbeResult)
})
