import { expect, test } from 'bun:test'
import { windowsCheckHost } from '../src/project-scripts'

test('preparation termination awaits native exit and delayed output instead of a stale exitCode', async () => {
  const reports: Record<string, unknown>[] = []
  const output: Uint8Array[] = []
  let complete: () => void = () => {}
  const completed = new Promise<void>(resolve => { complete = resolve })
  // Model the Windows ordering: taskkill reports a missing PID while Bun has
  // not yet processed the helper's native completion. Its buffered stdout also
  // finishes later. The actual owner must retain both completion promises.
  const probe = `
const spawn = Bun.spawn.bind(Bun)
let helper
Bun.spawn = (...args) => {
  helper = spawn(...args)
  const reader = helper.stdout.getReader()
  const delayedOutput = new ReadableStream({ async start(controller) {
    while (true) {
      const item = await reader.read()
      if (item.done) break
      controller.enqueue(item.value)
    }
    await Bun.sleep(100)
    controller.close()
  } })
  return new Proxy(helper, { get(target, key) {
    if (key === 'exitCode') return null
    if (key === 'stdout') return delayedOutput
    const value = Reflect.get(target, key, target)
    return typeof value === 'function' ? value.bind(target) : value
  } })
}
Bun.spawnSync = () => {
  helper.stdin.write(new Uint8Array([2]))
  helper.stdin.flush()
  return { exitCode: 128, stdout: Buffer.from('process already exited'), stderr: Buffer.from('PID not found') }
}
`
  const helper = `
console.log('STACKS_OWNED_CHECK_READY')
await Bun.stdin.stream().getReader().read()
await Bun.sleep(50)
console.log('final helper output')
process.exit(7)
`
  let timer: ReturnType<typeof setTimeout> | undefined
  let stoppedAt = 0
  let completedAt = 0
  const owner = Bun.spawn([process.execPath, '--eval', probe + windowsCheckHost([process.execPath, '--eval', helper], 'test-owned-taskkill')], {
    stdin: 'ignore', stdout: 'pipe', stderr: 'pipe',
    ipc(message) {
      reports.push(message)
      if (message.ready) owner.send({ prepare: true })
      if (message.nativeReady) {
        stoppedAt = performance.now()
        owner.send({ stop: true })
      }
      if (Number.isInteger(message.exitCode)) {
        completedAt = performance.now()
        complete()
      }
    },
  })
  const readOutput = (async () => {
    for await (const chunk of owner.stdout) output.push(chunk)
  })()
  const stderr = new Response(owner.stderr).text()
  try {
    await Promise.race([completed, new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error('Owned completion never arrived')), 3000)
    })])
    expect(reports.filter(message => message.error)).toEqual([])
    expect(reports.filter(message => Number.isInteger(message.exitCode))).toEqual([{ exitCode: 7 }])
    expect(completedAt - stoppedAt).toBeGreaterThanOrEqual(140)
    expect(reports.find(message => message.preparationCleanupError)?.preparationCleanupError).toContain('taskkill exit 128')
  }
  finally {
    if (timer) clearTimeout(timer)
    owner.kill('SIGKILL')
    await owner.exited
    await readOutput
    expect(Buffer.concat(output).toString()).toContain('final helper output')
    expect(await stderr).toBe('')
  }
}, 5000)
