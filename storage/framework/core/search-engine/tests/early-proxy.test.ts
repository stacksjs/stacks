import { expect, test } from 'bun:test'
import { join } from 'node:path'

/**
 * `useSearchEngine()` before its driver has loaded.
 *
 * Every property came back as a function until then, `then` included, so the
 * proxy passed for a promise: `await useSearchEngine()` - or returning it from
 * an async function - never settled. And a method the driver lacks resolved
 * to `undefined` rather than failing, so a call made early "succeeded" having
 * done nothing. Run in its own process so the driver really is unloaded.
 */
test('the early proxy is not a thenable, and a missing method fails', async () => {
  const child = Bun.spawn([process.execPath, join(import.meta.dir, 'fixtures/early-proxy.ts')], {
    env: { ...process.env, APP_ENV: 'test' },
    stdout: 'pipe',
    stderr: 'pipe',
  })
  const [code, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()])
  const line = stdout.trim().split('\n').reverse().find(candidate => candidate.startsWith('{'))
  expect(code, `${stdout}\n${stderr}`).toBe(0)

  const result = JSON.parse(line!)
  expect(result.thenBeforeLoad).toBe('undefined')
  expect(result.awaited).toBe('settled')
  expect(result.missing).toMatch(/^rejected: .*has no method "noSuchMethod"/)
}, 30_000)
