import { expect, test } from 'bun:test'
import { captureProcessLeaseOwner, processLeaseOwnerStatus } from '../src/process-owner'

test('missing or malformed ownership never authorizes early recovery', () => {
  for (const value of [undefined, null, {}, { pid: 1 }, { host: 'x', boot: 'y', pid: -1, birth: '1' }])
    expect(processLeaseOwnerStatus(value)).toBe('unknown')
})

test.skipIf(process.platform !== 'linux')('a process incarnation distinguishes exit, PID reuse, reboot and another host', async () => {
  const owner = captureProcessLeaseOwner()!
  expect(owner).toBeDefined()
  expect(processLeaseOwnerStatus(owner)).toBe('alive')
  expect(processLeaseOwnerStatus({ ...owner, birth: `${BigInt(owner.birth) + 1n}` })).toBe('dead')
  expect(processLeaseOwnerStatus({ ...owner, boot: crypto.randomUUID() })).toBe('dead')
  expect(processLeaseOwnerStatus({ ...owner, host: 'foreign-host' })).toBe('unknown')
  expect(processLeaseOwnerStatus({ ...owner, namespace: 'pid:[1]' })).toBe('unknown')
  const child = Bun.spawn([process.execPath, '--no-env-file', '--config=/dev/null', '-e',
    `import { captureProcessLeaseOwner } from ${JSON.stringify(new URL('../src/process-owner.ts', import.meta.url).pathname)}; console.log(JSON.stringify(captureProcessLeaseOwner())); await new Response(Bun.stdin).text()`],
  { stdin: 'pipe', stdout: 'pipe', stderr: 'pipe' })
  try {
    const reader = child.stdout.getReader()
    const first = await reader.read()
    const captured = JSON.parse(new TextDecoder().decode(first.value))
    expect(processLeaseOwnerStatus(captured)).toBe('alive')
    child.stdin.end()
    expect(await child.exited).toBe(0)
    expect(processLeaseOwnerStatus(captured)).toBe('dead')
    reader.releaseLock()
  }
  finally { child.kill(); await child.exited }
})
