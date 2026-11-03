import { expect, test } from 'bun:test'
import { join } from 'node:path'

// A client keeps the last seq it saw. When the server restarts while it is
// away, the messages sent since must still count as newer than that seq,
// or a replay skips them and a client ignoring repeats drops them live.
async function serverLife(lastSeen: number): Promise<{ sent: number[], replayed: number[] }> {
  const child = Bun.spawn([process.execPath, '--no-env-file', join(import.meta.dir, 'fixtures/replay-restart.ts'), String(lastSeen)], { stdout: 'pipe', stderr: 'pipe' })
  const [code, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()])
  expect(code, stderr).toBe(0)
  return JSON.parse(stdout.trim().split('\n').at(-1)!)
}

test('messages sent after a restart are newer than every seq from before it', async () => {
  const before = await serverLife(0)
  const lastSeen = before.sent.at(-1)!
  await Bun.sleep(5)
  const after = await serverLife(lastSeen)

  expect(after.sent[0]!).toBeGreaterThan(lastSeen)
  expect(after.sent[1]).toBe(after.sent[0]! + 1)
  expect(after.replayed).toEqual(after.sent)
}, 20_000)
