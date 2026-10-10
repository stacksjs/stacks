import { expect, test } from 'bun:test'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

test('failed fulfilment rolls back and concurrent retries grant access once', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'stacks-order-fulfilment-'))
  const preload = join(directory, 'preload.ts')
  const config = join(directory, 'bunfig.toml')
  writeFileSync(preload, 'export {}\n')
  writeFileSync(config, `preload = [${JSON.stringify(preload)}]\n`)
  const child = Bun.spawn([process.execPath, `--config=${config}`, '--no-env-file', `${import.meta.dir}/fixtures/order-fulfilment.ts`], { env: { ...process.env, APP_ENV: 'test', DB_CONNECTION: 'sqlite', STACKS_ORDER_TEST_DIRECTORY: directory }, stdout: 'pipe', stderr: 'pipe' })
  const watchdog = setTimeout(() => child.kill(), 25_000)
  try {
    const [code, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()])
    expect(code, `${stdout}\n${stderr}`).toBe(0)
    expect(stdout).toContain('order fulfilment OK')
  }
  finally { clearTimeout(watchdog); child.kill(); rmSync(directory, { recursive: true, force: true }) }
}, 30_000)
