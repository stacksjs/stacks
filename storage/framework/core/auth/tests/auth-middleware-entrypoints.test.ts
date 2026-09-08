import { expect, test } from 'bun:test'

for (const shape of ['app', 'defaults']) {
  test(`${shape} Auth middleware shares auth state across package entrypoints`, async () => {
    const child = Bun.spawn([process.execPath, `${import.meta.dir}/fixtures/auth-middleware-entrypoints.ts`, shape], { stdout: 'pipe', stderr: 'pipe' })
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
