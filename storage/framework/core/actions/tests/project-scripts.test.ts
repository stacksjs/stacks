import { expect, test } from 'bun:test'
import { createHash } from 'node:crypto'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { runProjectScripts } from '../src/project-scripts'

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
