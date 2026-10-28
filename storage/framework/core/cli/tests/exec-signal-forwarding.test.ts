import { expect, test } from 'bun:test'
import { mkdtempSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import process from 'node:process'

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  test.skipIf(process.platform === 'win32')(`parent-only ${signal} reaches the awaited child and releases its forwarding listeners`, async () => {
    const directory = mkdtempSync(join(tmpdir(), 'stacks-signal-'))
    const parent = Bun.spawn([process.execPath, '--no-env-file', join(import.meta.dir, 'fixtures/signal-parent.ts'), directory, signal, 'true'], { stdout: 'pipe', stderr: 'pipe' })
    let childPid: number | undefined
    let timer: ReturnType<typeof setTimeout> | undefined
    try {
      const ready = Bun.file(join(directory, 'child'))
      const deadline = Date.now() + 10_000
      while (!await ready.exists() && Date.now() < deadline && parent.exitCode === null) await Bun.sleep(10)
      expect(await ready.exists()).toBe(true)
      childPid = Number(await ready.text())
      parent.kill(signal)
      const exited = await Promise.race([parent.exited, new Promise<number>(resolve => { timer = setTimeout(() => resolve(-1), 5000) })])
      expect(exited).toBe(0)
      expect(await Bun.file(join(directory, 'drained')).text()).toBe('drained')
      const result = await Bun.file(join(directory, 'result')).json()
      expect(result.ok).toBe(true)
      expect(result.after).toBe(result.before)
    }
    finally {
      if (timer) clearTimeout(timer)
      if (parent.exitCode === null) parent.kill('SIGKILL')
      if (childPid) {
        try { process.kill(childPid, 'SIGKILL') }
        catch { /* Already exited. */ }
      }
      await parent.exited
      rmSync(directory, { recursive: true, force: true })
    }
  }, 20_000)
}
