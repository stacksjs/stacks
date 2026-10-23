import { expect, test } from 'bun:test'
import { createHash } from 'node:crypto'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { runProjectScripts, windowsCheckHost } from '../src/project-scripts'

test.each([0, 7])('a completed check disposes its unreferenced normal descendant before settling (exit %s)', async (exitCode) => {
  const root = mkdtempSync(join(tmpdir(), 'stacks-project-ownership-'))
  writeFileSync(join(root, 'package.json'), JSON.stringify({ scripts: { check: 'bun check.ts' } }))
  writeFileSync(join(root, 'check.ts'), `
const child = Bun.spawn([process.execPath, '-e', 'process.on("SIGTERM", () => {}); await Bun.write("child.ready", "ready"); setInterval(() => {}, 1000)'], { stdin: 'ignore', stdout: 'ignore', stderr: 'ignore' })
await Bun.write('child.pid', String(child.pid))
while (!await Bun.file('child.ready').exists()) await Bun.sleep(10)
child.unref()
process.exitCode = ${exitCode}
`)
  try {
    const execution = runProjectScripts({ cwd: root, scripts: ['check'], timeoutMs: process.platform === 'win32' ? 15_000 : 3000 })
    if (exitCode === 0) expect((await execution).checks[0]?.exitCode).toBe(0)
    else await expect(execution).rejects.toThrow('failed with exit code 7')
    const pid = Number(readFileSync(join(root, 'child.pid'), 'utf8'))
    let alive = true
    try { process.kill(pid, 0) }
    catch { alive = false }
    expect(alive, 'the normal descendant must be gone before the receipt is issued').toBe(false)
  }
  finally {
    if (existsSync(join(root, 'child.pid'))) {
      const pid = Number(readFileSync(join(root, 'child.pid'), 'utf8'))
      try {
        if (process.platform === 'win32') Bun.spawnSync(['taskkill', '/PID', String(pid), '/T', '/F'], { stdout: 'ignore', stderr: 'ignore', timeout: 2000 })
        else process.kill(pid, 'SIGKILL')
      }
      catch { /* Already disposed test-owned descendant. */ }
    }
    rmSync(root, { recursive: true, force: true })
  }
}, 30_000)

test('owned cleanup retains all completed command output in the receipt hash', async () => {
  const root = mkdtempSync(join(tmpdir(), 'stacks-project-output-'))
  writeFileSync(join(root, 'package.json'), JSON.stringify({ scripts: { check: 'bun check.ts' } }))
  writeFileSync(join(root, 'check.ts'), '')
  try {
    // Capture Bun's actual platform banner independently of the owned runner.
    const bun = Bun.which('bun', { cwd: root })
    expect(bun).toBeTruthy()
    const baseline = Bun.spawn([bun!, 'run', 'check'], { cwd: root, stdout: 'pipe', stderr: 'pipe' })
    const [baselineCode, stdout, banner] = await Promise.all([
      baseline.exited, new Response(baseline.stdout).arrayBuffer(), new Response(baseline.stderr).arrayBuffer(),
    ])
    expect(baselineCode).toBe(0)
    expect(stdout.byteLength).toBe(0)
    expect(Buffer.from(banner).toString()).toContain('check.ts')
    // One pipe establishes byte order without depending on stdout/stderr scheduling.
    // A multi-chunk payload and final marker catch dropped/truncated completion output.
    const payload = `known-command-output\n${'0123456789abcdef'.repeat(16_384)}\ncompleted-command-output\n`
    writeFileSync(join(root, 'check.ts'), `await Bun.write(Bun.stderr, ${JSON.stringify(payload)})`)
    const observed: Record<'stdout' | 'stderr', Buffer[]> = { stdout: [], stderr: [] }
    const receipt = await runProjectScripts({
      cwd: root, scripts: ['check'], timeoutMs: process.platform === 'win32' ? 15_000 : 3000,
      onOutput: (chunk, stream) => { observed[stream].push(Buffer.from(chunk)) },
    })
    const expected = createHash('sha256').update(Buffer.from(banner)).update(payload).digest('hex')
    const captured = Object.fromEntries(Object.entries(observed).map(([stream, chunks]) => {
      const bytes = Buffer.concat(chunks)
      return [stream, { bytes: bytes.length, first: bytes.subarray(0, 120).toString(), last: bytes.subarray(-80).toString() }]
    }))
    expect(receipt.checks[0]?.outputSha256, JSON.stringify(captured)).toBe(expected)
    expect(Buffer.concat(observed.stderr).byteLength).toBe(banner.byteLength + Buffer.byteLength(payload))
    expect(Buffer.concat(observed.stdout).byteLength).toBe(0)
  }
  finally { rmSync(root, { recursive: true, force: true }) }
}, 30_000)

test('cancellation disposes an already started owned check before rejecting', async () => {
  const root = mkdtempSync(join(tmpdir(), 'stacks-project-cancellation-'))
  writeFileSync(join(root, 'package.json'), JSON.stringify({ scripts: { check: 'bun check.ts' } }))
  writeFileSync(join(root, 'check.ts'), 'await Bun.write("check.pid", String(process.pid)); await Bun.sleep(60_000)')
  const controller = new AbortController()
  const budget = process.platform === 'win32' ? 15_000 : 3000
  const execution = runProjectScripts({ cwd: root, scripts: ['check'], timeoutMs: budget, signal: controller.signal })
  void execution.catch(() => {})
  try {
    const until = performance.now() + budget
    while (!existsSync(join(root, 'check.pid')) && performance.now() < until) await Bun.sleep(10)
    expect(existsSync(join(root, 'check.pid')), 'the check must start before cancellation is tested').toBe(true)
    controller.abort()
    await expect(execution).rejects.toThrow('was interrupted or exceeded its execution budget')
    const pid = Number(readFileSync(join(root, 'check.pid'), 'utf8'))
    let alive = true
    try { process.kill(pid, 0) }
    catch { alive = false }
    expect(alive).toBe(false)
  }
  finally {
    controller.abort()
    await execution.catch(() => {})
    if (existsSync(join(root, 'check.pid'))) {
      const pid = Number(readFileSync(join(root, 'check.pid'), 'utf8'))
      try {
        if (process.platform === 'win32') Bun.spawnSync(['taskkill', '/PID', String(pid), '/T', '/F'], { stdout: 'ignore', stderr: 'ignore', timeout: 2000 })
        else process.kill(pid, 'SIGKILL')
      }
      catch { /* Already disposed test-owned check. */ }
    }
    rmSync(root, { recursive: true, force: true })
  }
}, 30_000)

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
