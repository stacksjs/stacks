import { expect, test } from 'bun:test'
import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import { join } from 'node:path'

test('signed storage downloads enforce live access and files in both HTTP modes', async () => {
  const runtime = join(import.meta.dir, '../../../runtime')
  await mkdir(runtime, { recursive: true })
  const directory = await mkdtemp(join(runtime, 'signed-storage-'))
  // Isolate the storage singleton and signing key from other test suites.
  const child = Bun.spawn([process.execPath, `${import.meta.dir}/fixtures/signed-storage.ts`, directory], {
    env: { ...process.env, APP_ENV: 'test', APP_KEY: 'signed-storage-test-key-at-least-32-characters' },
    stdout: 'pipe',
    stderr: 'pipe',
  })
  const watchdog = setTimeout(() => child.kill(), 10_000)
  try {
    const [code, out, error] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()])
    expect(code, out + error).toBe(0)
  }
  finally {
    clearTimeout(watchdog)
    await rm(directory, { recursive: true, force: true })
  }
}, 15_000)
