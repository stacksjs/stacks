import { expect, test } from 'bun:test'
import { mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { runBoundedProcess } from '../src/process'

const options = { timeoutMs: 1000, stdoutBytes: 1024, stderrBytes: 1024, label: 'Native process fixture' }

async function fixture(run: (directory: string, args: string[]) => Promise<void>) {
  const directory = await realpath(await mkdtemp(join(tmpdir(), 'stacks-bounded-process-')))
  const config = join(directory, 'bunfig.toml')
  await writeFile(config, 'preload = []\n')
  try { await run(directory, [process.execPath, '--no-env-file', `--config=${config}`]) }
  finally { await rm(directory, { recursive: true, force: true }) }
}

test('captures both streams, literal argv and a nonzero exit without interpreting shell syntax', async () => {
  await fixture(async (directory, args) => {
    const script = join(directory, 'child.ts')
    await writeFile(script, 'console.log(JSON.stringify({ argument: process.argv[2], cwd: process.cwd(), environment: process.env.BOUNDED_PROCESS_TEST })); console.error("bounded diagnostic"); process.exitCode = 7')
    const result = await runBoundedProcess([...args, script, '$(do-not-run); literal'], { ...options, cwd: directory, env: { ...process.env, BOUNDED_PROCESS_TEST: 'declared-value' } })
    expect(result).toEqual({ exitCode: 7, stdout: `${JSON.stringify({ argument: '$(do-not-run); literal', cwd: directory, environment: 'declared-value' })}\n`, stderr: 'bounded diagnostic\n' })
  })
})

test('drains stdout and stderr concurrently beyond pipe capacity before awaiting exit', async () => {
  await fixture(async (directory, args) => {
    const script = join(directory, 'child.ts')
    await writeFile(script, 'await Promise.all([new Promise(r => process.stdout.write("a".repeat(524288), r)), new Promise(r => process.stderr.write("b".repeat(524288), r))])')
    const result = await runBoundedProcess([...args, script], { ...options, timeoutMs: 5000, stdoutBytes: 524288, stderrBytes: 524288 })
    expect(result.exitCode).toBe(0)
    expect(result.stdout).toBe('a'.repeat(524288)); expect(result.stderr).toBe('b'.repeat(524288))
  })
}, 10000)

test('bounds multibyte stdout by bytes and reaps the actual producer before rejecting', async () => {
  await fixture(async (directory, args) => {
    const script = join(directory, 'child.ts'), pid = join(directory, 'child.pid')
    await writeFile(script, `await Bun.write(${JSON.stringify(pid)}, String(process.pid)); process.stdout.write('😀'.repeat(300)); await Bun.sleep(60000)`)
    await expect(runBoundedProcess([...args, script], options)).rejects.toThrow('stdout exceeds byte limit')
    const producer = Number(await readFile(pid, 'utf8'))
    expect(() => process.kill(producer, 0)).toThrow()
  })
})

test('bounds stderr independently and enforces a deadline against a SIGTERM-resistant process', async () => {
  await fixture(async (directory, args) => {
    for (const mode of ['stderr', 'deadline']) {
      const script = join(directory, `${mode}.ts`), pid = join(directory, `${mode}.pid`)
      await writeFile(script, `await Bun.write(${JSON.stringify(pid)}, String(process.pid)); process.on('SIGTERM', () => {}); ${mode === 'stderr' ? "process.stderr.write('x'.repeat(1025));" : ''} await Bun.sleep(60000)`)
      await expect(runBoundedProcess([...args, script], options)).rejects.toThrow(mode === 'stderr' ? 'stderr exceeds byte limit' : 'timed out')
      const producer = Number(await readFile(pid, 'utf8'))
      expect(() => process.kill(producer, 0)).toThrow()
    }
  })
}, 10000)

test.skipIf(process.platform === 'win32')('an exited parent cannot extend the deadline through a descendant holding inherited pipes', async () => {
  await fixture(async (directory, args) => {
    const child = join(directory, 'descendant.ts'), parent = join(directory, 'parent.ts'), pid = join(directory, 'descendant.pid')
    await writeFile(child, `await Bun.write(${JSON.stringify(pid)}, String(process.pid)); await Bun.sleep(60000)`)
    await writeFile(parent, `const child = Bun.spawn(${JSON.stringify([...args, child])}, { stdout: 'inherit', stderr: 'inherit' }); while (!await Bun.file(${JSON.stringify(pid)}).exists()) await Bun.sleep(5); child.unref(); process.exit(0)`)
    await expect(runBoundedProcess([...args, parent], options)).rejects.toThrow('timed out')
    const descendant = Number(await readFile(pid, 'utf8'))
    let alive = true
    for (let attempt = 0; attempt < 100; attempt++) {
      try { process.kill(descendant, 0) }
      catch { alive = false; break }
      await Bun.sleep(10)
    }
    expect(alive).toBe(false)
  })
}, 10000)

test('invalid budgets reject before a child can create its marker', async () => {
  await fixture(async (directory, args) => {
    const script = join(directory, 'child.ts'), marker = join(directory, 'created')
    await writeFile(script, `await Bun.write(${JSON.stringify(marker)}, 'unexpected')`)
    for (const invalid of [{ timeoutMs: 0 }, { timeoutMs: 60001 }, { stdoutBytes: 0 }, { stderrBytes: 2_000_001 }]) {
      await expect(runBoundedProcess([...args, script], { ...options, ...invalid })).rejects.toThrow('Invalid bounded process')
      expect(await Bun.file(marker).exists()).toBe(false)
    }
  })
})
