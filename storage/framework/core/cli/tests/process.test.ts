import { expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
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
    const result = await runBoundedProcess([...args, script, '$(do-not-run); literal'], { ...options, timeoutMs: 120000, cwd: directory, env: { ...process.env, BOUNDED_PROCESS_TEST: 'declared-value' } })
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
    for (const invalid of [{ timeoutMs: 0 }, { timeoutMs: 120001 }, { stdoutBytes: 0 }, { stderrBytes: 2_000_001 }]) {
      await expect(runBoundedProcess([...args, script], { ...options, ...invalid })).rejects.toThrow('Invalid bounded process')
      expect(await Bun.file(marker).exists()).toBe(false)
    }
  })
})

for (const stream of ['stdout', 'stderr'] as const) {
  for (const bytes of [[0xC3, 0x28], [0xE2, 0x82]]) {
    test(`strict UTF-8 rejects ${stream} bytes ${bytes.join(',')} and reaps a live producer`, async () => {
      await fixture(async (directory, args) => {
        const script = join(directory, 'encoding.ts'), pid = join(directory, 'encoding.pid')
        const fd = stream === 'stdout' ? 1 : 2
        await writeFile(script, `import { writeSync, closeSync } from 'node:fs'; await Bun.write(${JSON.stringify(pid)}, String(process.pid)); writeSync(${fd}, new Uint8Array(${JSON.stringify(bytes)})); closeSync(${fd}); await Bun.sleep(60000)`)
        await expect(runBoundedProcess([...args, script], { ...options, timeoutMs: 5000, strictUtf8: true })).rejects.toThrow(TypeError)
        const producer = Number(await readFile(pid, 'utf8'))
        expect(Number.isSafeInteger(producer)).toBe(true)
        expect(() => process.kill(producer, 0)).toThrow()
      })
    }, 10000)
  }
}

test('strict UTF-8 preserves a BOM and a multibyte character split across writes', async () => {
  await fixture(async (directory, args) => {
    const script = join(directory, 'valid-encoding.ts')
    await writeFile(script, "import { writeSync } from 'node:fs'; for (const byte of [239,187,191,226,130,172,10]) { writeSync(1, new Uint8Array([byte])); await Bun.sleep(1) }")
    const result = await runBoundedProcess([...args, script], { ...options, timeoutMs: 5000, strictUtf8: true })
    expect(result).toEqual({ exitCode: 0, stdout: '\uFEFF€\n', stderr: '' })
  })
})

test('default and explicitly permissive capture retain BOMs and replacement decoding on both streams', async () => {
  await fixture(async (directory, args) => {
    const script = join(directory, 'permissive-encoding.ts')
    await writeFile(script, "import { writeSync } from 'node:fs'; for (const fd of [1,2]) writeSync(fd, new Uint8Array([239,187,191,195,40]))")
    for (const mode of [{}, { strictUtf8: false }]) {
      const result = await runBoundedProcess([...args, script], { ...options, ...mode, timeoutMs: 5000 })
      expect(result).toEqual({ exitCode: 0, stdout: '\uFEFF�(', stderr: '\uFEFF�(' })
    }
  })
})

async function cancellationFixture(run: (directory: string, args: string[]) => Promise<void>) {
  const directory = await realpath(await mkdtemp(join(tmpdir(), 'stacks-process-cancellation-')))
  await writeFile(join(directory, 'bunfig.toml'), 'preload=[]\n[install]\nauto="disable"\n')
  let completed = false
  try { await run(directory, [process.execPath, '--no-install', '--no-env-file', `--config=${join(directory, 'bunfig.toml')}`]); completed = true }
  finally {
    if (completed) await rm(directory, { recursive: true })
    else console.error('BOUNDED_PROCESS_CANCELLATION_FIXTURE_RETAINED', directory)
  }
}

async function waitForCancellationPid(path: string): Promise<number> {
  for (let attempt = 0; attempt < 300; attempt++) {
    const value = Number(await readFile(path, 'utf8').catch(() => ''))
    if (Number.isSafeInteger(value) && value > 0) return value
    await Bun.sleep(10)
  }
  throw new Error('Cancellation producer did not report readiness')
}

function observedSignal(controller: AbortController, beforeListen?: () => void) {
  const signal = controller.signal
  const add = signal.addEventListener.bind(signal), remove = signal.removeEventListener.bind(signal)
  const active = new Set<EventListenerOrEventListenerObject>()
  let registrations = 0, removals = 0
  signal.addEventListener = (type: string, listener: EventListenerOrEventListenerObject | null, options?: boolean | AddEventListenerOptions) => {
    if (listener === null) return
    if (type === 'abort' && listener) { registrations++; active.add(listener); beforeListen?.() }
    add(type, listener, options)
  }
  signal.removeEventListener = (type: string, listener: EventListenerOrEventListenerObject | null, options?: boolean | EventListenerOptions) => {
    if (listener === null) return
    if (type === 'abort' && listener) { removals++; active.delete(listener) }
    remove(type, listener, options)
  }
  return { signal, snapshot: () => ({ registrations, removals, active: active.size }) }
}

test('cancellation rejects before launch when the signal is already aborted', async () => {
  await cancellationFixture(async (directory, args) => {
    const marker = join(directory, 'unexpected-launch'), script = join(directory, 'pre-aborted.ts')
    await writeFile(script, `await Bun.write(${JSON.stringify(marker)}, 'launched')`)
    const controller = new AbortController()
    const reason = { toString() { throw new Error('Caller reason must not be coerced') } }
    controller.abort(reason)
    const signal = observedSignal(controller)
    const error = await runBoundedProcess([...args, script], { ...options, signal: signal.signal }).then(() => null, error => error)
    expect(await Bun.file(marker).exists()).toBe(false)
    expect(error).toBeInstanceOf(Error)
    expect(error.message).toBe('Native process fixture canceled')
    expect(error.cause).toBe(reason)
    expect(signal.snapshot()).toEqual({ registrations: 0, removals: 0, active: 0 })
  })
})

for (const pipesClosed of [false, true]) test(`cancellation owns a live producer with ${pipesClosed ? 'only exit' : 'pipes and exit'} pending`, async () => {
  await cancellationFixture(async (directory, args) => {
    const pid = join(directory, 'producer.pid'), script = join(directory, 'producer.ts')
    await writeFile(script, `import { closeSync } from 'node:fs'; process.on('SIGTERM', () => {}); ${pipesClosed ? 'closeSync(1); closeSync(2);' : ''} await Bun.write(${JSON.stringify(pid)}, String(process.pid)); await Bun.sleep(60000)`)
    const controller = new AbortController(), signal = observedSignal(controller)
    const result = runBoundedProcess([...args, script], { ...options, timeoutMs: 5000, signal: signal.signal }).then(value => ({ value, error: null }), error => ({ value: null, error }))
    try {
      const producer = await waitForCancellationPid(pid)
      controller.abort('private request cancellation reason')
      const settled = await result
      expect(settled.error?.message).toBe('Native process fixture canceled')
      expect(settled.error?.cause).toBe('private request cancellation reason')
      expect(() => process.kill(producer, 0)).toThrow()
      expect(signal.snapshot()).toEqual({ registrations: 1, removals: 1, active: 0 })
    }
    finally { controller.abort(); await result }
  })
}, 10000)

test.skipIf(process.platform === 'win32')('cancellation stops an inherited-pipe descendant after its parent exits', async () => {
  await cancellationFixture(async (directory, args) => {
    const pid = join(directory, 'descendant.pid'), parentPid = join(directory, 'parent.pid')
    const child = join(directory, 'descendant.ts'), parent = join(directory, 'parent.ts')
    await writeFile(child, `process.on('SIGTERM', () => {}); await Bun.write(${JSON.stringify(pid)}, String(process.pid)); await Bun.sleep(60000)`)
    await writeFile(parent, `await Bun.write(${JSON.stringify(parentPid)}, String(process.pid)); const child=Bun.spawn(${JSON.stringify([...args, child])},{stdout:'inherit',stderr:'inherit'}); while(!await Bun.file(${JSON.stringify(pid)}).exists())await Bun.sleep(5); child.unref(); process.exit(0)`)
    const controller = new AbortController(), signal = observedSignal(controller)
    const result = runBoundedProcess([...args, parent], { ...options, timeoutMs: 5000, signal: signal.signal }).then(() => null, error => error)
    try {
      const descendant = await waitForCancellationPid(pid), producer = await waitForCancellationPid(parentPid)
      let parentGone = false
      for (let attempt = 0; attempt < 200; attempt++) {
        try { process.kill(producer, 0) }
        catch { parentGone = true; break }
        await Bun.sleep(5)
      }
      expect(parentGone).toBe(true)
      controller.abort()
      const error = await result
      expect(error?.message).toBe('Native process fixture canceled')
      let descendantGone = false
      for (let attempt = 0; attempt < 100; attempt++) {
        try { process.kill(descendant, 0) }
        catch { descendantGone = true; break }
        await Bun.sleep(10)
      }
      expect(descendantGone).toBe(true)
      expect(signal.snapshot()).toEqual({ registrations: 1, removals: 1, active: 0 })
    }
    finally { controller.abort(); await result }
  })
}, 10000)

test('cancellation during listener registration is not lost', async () => {
  await cancellationFixture(async (directory, args) => {
    const script = join(directory, 'registration-race.ts')
    await writeFile(script, 'await Bun.sleep(60000)')
    const controller = new AbortController()
    const signal = observedSignal(controller, () => controller.abort())
    await expect(runBoundedProcess([...args, script], { ...options, timeoutMs: 1000, signal: signal.signal })).rejects.toThrow('Native process fixture canceled')
    expect(signal.snapshot()).toEqual({ registrations: 1, removals: 1, active: 0 })
  })
})

test('completed capture removes its cancellation listener and late cancellation has no effect', async () => {
  await cancellationFixture(async (directory, args) => {
    const script = join(directory, 'complete.ts')
    await writeFile(script, 'console.log("complete"); process.exitCode=7')
    const controller = new AbortController(), signal = observedSignal(controller)
    const result = await runBoundedProcess([...args, script], { ...options, signal: signal.signal })
    expect(result).toEqual({ exitCode: 7, stdout: 'complete\n', stderr: '' })
    expect(signal.snapshot()).toEqual({ registrations: 1, removals: 1, active: 0 })
    controller.abort()
    expect(signal.snapshot().active).toBe(0)
  })
})

for (const mode of ['overflow', 'deadline', 'encoding'] as const) test(`a settled ${mode} failure retains its cause after cancellation`, async () => {
  await cancellationFixture(async (directory, args) => {
    const script = join(directory, 'failure.ts'), pid = join(directory, 'failure.pid')
    await writeFile(script, `import { writeSync, closeSync } from 'node:fs'; await Bun.write(${JSON.stringify(pid)},String(process.pid)); ${mode === 'overflow' ? "writeSync(1,'x'.repeat(1025));" : mode === 'encoding' ? 'writeSync(1,new Uint8Array([195,40])); closeSync(1);' : ''} await Bun.sleep(60000)`)
    const controller = new AbortController(), signal = observedSignal(controller)
    const error = await runBoundedProcess([...args, script], { ...options, strictUtf8: true, signal: signal.signal }).then(() => null, error => error)
    expect(error).toBeInstanceOf(mode === 'encoding' ? TypeError : Error)
    if (mode !== 'encoding') expect(error.message).toContain(mode === 'overflow' ? 'stdout exceeds byte limit' : 'timed out')
    expect(signal.snapshot()).toEqual({ registrations: 1, removals: 1, active: 0 })
    controller.abort()
    const producer = Number(await readFile(pid, 'utf8'))
    expect(() => process.kill(producer, 0)).toThrow()
  })
})

test('invalid cancellation options reject before launch', async () => {
  await cancellationFixture(async (directory, args) => {
    const marker = join(directory, 'invalid-signal-launch'), script = join(directory, 'invalid-signal.ts')
    await writeFile(script, `await Bun.write(${JSON.stringify(marker)}, 'unexpected')`)
    for (const signal of [null, 42, {}]) {
      // @ts-expect-error Deliberately invalid cancellation option at the public admission seam.
      await expect(runBoundedProcess([...args, script], { ...options, signal })).rejects.toThrow('Invalid bounded process signal')
      expect(await Bun.file(marker).exists()).toBe(false)
    }
  })
})


test('the first cancellation survives a later native decoding failure', async () => {
  await cancellationFixture(async (directory, args) => {
    const script = join(directory, 'buffered-encoding.ts'), marker = join(directory, 'buffered-ready.json')
    await writeFile(script, `import { writeSync, closeSync, writeFileSync } from 'node:fs'; writeSync(1,new Uint8Array([195,40])); closeSync(1); writeFileSync(${JSON.stringify(marker)},JSON.stringify({pid:process.pid})); await Bun.sleep(60000)`)
    const controller = new AbortController(), observed = observedSignal(controller)
    const add = observed.signal.addEventListener.bind(observed.signal)
    let producer = 0
    observed.signal.addEventListener = (type: string, listener: EventListenerOrEventListenerObject | null, options?: boolean | AddEventListenerOptions) => {
      if (listener === null) return
      add(type, listener, options)
      // Hold this registration turn while a real child fills and closes its
      // pipe. Cancellation wins before the queued decoder continuation runs.
      const deadline = performance.now() + 3000
      while (performance.now() < deadline) {
        try { producer = JSON.parse(readFileSync(marker, 'utf8')).pid }
        catch { /* The file is not complete yet. */ }
        if (Number.isSafeInteger(producer) && producer > 0) break
        Bun.sleepSync(5)
      }
      if (!producer) throw new Error('Buffered producer did not become ready')
      controller.abort('first cancellation')
    }
    const error = await runBoundedProcess([...args, script], { ...options, timeoutMs: 5000, strictUtf8: true, signal: observed.signal }).then(() => null, error => error)
    expect(error?.message).toBe('Native process fixture canceled')
    expect(error?.cause).toBe('first cancellation')
    expect(error).not.toBeInstanceOf(TypeError)
    expect(() => process.kill(producer, 0)).toThrow()
    expect(observed.snapshot()).toEqual({ registrations: 1, removals: 1, active: 0 })
  })
}, 10000)
