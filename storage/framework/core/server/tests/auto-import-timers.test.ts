import { expect, test } from 'bun:test'
import process from 'node:process'

for (const mode of ['success', 'failure', 'timeout']) {
  test(`primitive auto-import timers release on ${mode}`, async () => {
    const child = Bun.spawn([process.execPath, `${import.meta.dir}/fixtures/auto-import-timers.ts`, mode], { stdout: 'pipe', stderr: 'pipe' })
    const watchdog = setTimeout(() => child.kill(), 10_000)
    try {
      const [code, out, error] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()])
      expect(code, out + error).toBe(0)
    }
    finally {
      clearTimeout(watchdog)
    }
  }, 15_000)
}
