import { expect, test } from 'bun:test'

for (const [fixture, description] of [
  ['maintenance-middleware', 'a warmed maintenance middleware observes live mode changes'],
  ['maintenance-paths', 'maintenance paths follow working-directory changes and live files'],
]) {
  test(description, async () => {
    const child = Bun.spawn([process.execPath, `${import.meta.dir}/fixtures/${fixture}.ts`], { stdout: 'pipe', stderr: 'pipe' })
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
