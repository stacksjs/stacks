import { expect, test } from 'bun:test'
import { createHash } from 'node:crypto'
import type { PreparedCompletedArtifactReceipt } from '../src/completed-artifact-directory'
import { chmodSync, closeSync, existsSync, linkSync, lstatSync, mkdirSync, mkdtempSync, openSync, readFileSync, readdirSync, readlinkSync, realpathSync, renameSync, rmSync, symlinkSync, truncateSync, unlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { completedArtifactLimits, prepareCompletedArtifactDirectorySync, writeCompletedArtifact } from '../src/completed-artifact-directory'

// Public API plus real filesystem catches metadata-before-payload ordering, not hardware power-loss durability.
test('preparation owns synced zero files and frozen metadata before a live once-only publication', () => {
  const parent = realpathSync(mkdtempSync(join(tmpdir(), 'prepared-artifact-')))
  try {
    const directory = join(parent, 'result')
    const bytes = new Uint8Array([0, 255, 17])
    const manifest = '{"version":1,"label":"é"}\n'
    const prepared = prepareCompletedArtifactDirectorySync(directory, [{ path: 'images/raw.bin', contents: bytes }, { path: 'note.txt', contents: '雪\n' }], manifest, { directories: ['empty'] })
    expect(Object.keys(prepared).sort()).toEqual(['publishSync', 'receipt'])
    expect(Object.isFrozen(prepared)).toBe(true)
    const receipt = prepared.receipt
    expect(receipt.directory).toBe(directory)
    expect(receipt.parent.path).toBe(parent)
    expect(receipt.completedManifest).toBe(join(directory, 'manifest.json'))
    expect(readdirSync(directory).sort()).toEqual(['empty', 'images', 'manifest.pending.json', 'note.txt'])
    for (const file of [...receipt.files, receipt.pendingManifest]) {
      const observed = lstatSync(file.path, { bigint: true })
      expect(observed.size).toBe(0n)
      expect(file.ino).toBe(observed.ino.toString())
      expect(file.dev).toBe(observed.dev.toString())
      expect(file.uid).toBe(observed.uid.toString())
      expect(file.nlink).toBe('1')
      expect(file.mode).toBe(0o600)
      expect(Object.isFrozen(file)).toBe(true)
    }
    expect(receipt.files[0]!.bytes).toBe(3)
    expect(receipt.files[0]!.sha256).toBe(createHash('sha256').update(bytes).digest('hex'))
    expect(receipt.pendingManifest.bytes).toBe(Buffer.byteLength(manifest))
    expect(Object.isFrozen(receipt)).toBe(true)
    expect(Object.isFrozen(receipt.files)).toBe(true)
    expect(Object.isFrozen(receipt.directories)).toBe(true)
    for (const folder of [receipt.root, ...receipt.directories]) {
      const observed = lstatSync(folder.path, { bigint: true })
      expect(folder.type).toBe('directory')
      expect(folder.mode).toBe(0o700)
      expect(folder.ino).toBe(observed.ino.toString())
      expect(folder.birthtimeNs).toBe(observed.birthtimeNs.toString())
      expect(Object.isFrozen(folder)).toBe(true)
    }
    expect(Object.isFrozen(receipt.parent)).toBe(true)
    expect(JSON.stringify(receipt)).not.toContain('contents')
    expect(JSON.stringify(receipt)).not.toContain('version')
    bytes.fill(91)
    const publish = prepared.publishSync
    expect(publish.call({ receipt: {} })).toEqual({ directory, manifest: join(directory, 'manifest.json') })
    expect([...readFileSync(join(directory, 'images/raw.bin'))]).toEqual([0, 255, 17])
    expect(readFileSync(join(directory, 'note.txt'), 'utf8')).toBe('雪\n')
    expect(readFileSync(join(directory, 'manifest.json'), 'utf8')).toBe(manifest)
    expect(lstatSync(join(directory, 'manifest.json'), { bigint: true }).ino.toString()).toBe(receipt.pendingManifest.ino)
    expect(readdirSync(directory)).not.toContain('manifest.pending.json')
    expect(() => publish()).toThrow('consumed')
  }
  finally { rmSync(parent, { recursive: true, force: true }) }
})

test('byte views use intrinsic offsets and ignore caller iterators and typed-array property overrides', () => {
  const parent = mkdtempSync(join(tmpdir(), 'prepared-byte-view-'))
  try {
    let calls = 0
    const contents = Buffer.from([99, 0, 128, 255, 88]).subarray(1, 4)
    for (const field of ['buffer', 'byteLength', 'byteOffset', 'length']) Object.defineProperty(contents, field, { get() { calls++; throw new Error('must not execute') } })
    Object.defineProperty(contents, Symbol.iterator, { value() { calls++; throw new Error('must not iterate') } })
    const prepared = prepareCompletedArtifactDirectorySync(join(parent, 'bytes'), [{ path: 'raw.bin', contents }], '{}')
    Buffer.prototype.fill.call(contents, 42)
    prepared.publishSync()
    expect([...readFileSync(join(parent, 'bytes/raw.bin'))]).toEqual([0, 128, 255])
    expect(calls).toBe(0)
  }
  finally { rmSync(parent, { recursive: true, force: true }) }
})

test('proxy traps, accessors, custom lists and hidden or symbol aliases never execute or create files', () => {
  const parent = mkdtempSync(join(tmpdir(), 'prepared-plain-input-'))
  try {
    let calls = 0
    const trap = () => { calls++; throw new Error('caller code executed') }
    const entry = { path: 'a', contents: '' }
    const proxy = new Proxy(entry, { get: trap, ownKeys: trap, getPrototypeOf: trap, getOwnPropertyDescriptor: trap })
    const accessor = Object.defineProperty({ path: 'a' }, 'contents', { enumerable: true, get: trap })
    const hidden = Object.defineProperty({ ...entry }, 'extra', { value: '' })
    const symbol = { ...entry, [Symbol('alias')]: '' }
    const listAccessor = Object.defineProperty([], '0', { enumerable: true, get: trap })
    const iterator = Object.defineProperty([entry], Symbol.iterator, { value: trap })
    const custom = Object.setPrototypeOf([entry], { [Symbol.iterator]: trap })
    const shared = new Uint8Array(new SharedArrayBuffer(1))
    const cases: [unknown, unknown, unknown][] = [
      [[proxy], '{}', {}], [new Proxy([entry], { get: trap, ownKeys: trap, getPrototypeOf: trap }), '{}', {}],
      [[accessor], '{}', {}], [[hidden], '{}', {}], [[symbol], '{}', {}], [listAccessor, '{}', {}],
      [iterator, '{}', {}], [custom, '{}', {}], [new Array(1), '{}', {}],
      [[entry], '{}', new Proxy({}, { get: trap, ownKeys: trap, getPrototypeOf: trap })],
      [[entry], '{}', Object.defineProperty({}, 'directories', { enumerable: true, get: trap })],
      [[entry], '{}', Object.defineProperty({}, 'directories', { value: [] })],
      [[entry], '{}', { [Symbol('extra')]: [] }], [[entry], { then: trap }, {}],
      [[{ path: 'a', contents: shared }], '{}', {}], [[{ path: 'a', contents: trap }], '{}', {}],
      [[{ path: 'a', contents: new Proxy(new Uint8Array(1), { get: trap, getPrototypeOf: trap }) }], '{}', {}],
    ]
    for (const [entries, manifest, options] of cases) expect(() => prepareCompletedArtifactDirectorySync(join(parent, 'invalid'), entries as never, manifest as never, options as never)).toThrow()
    expect(calls).toBe(0)
    expect(readdirSync(parent)).toEqual([])
  }
  finally { rmSync(parent, { recursive: true, force: true }) }
})

test('private caps, case/depth/reserved collisions and EEXIST fail without adopting or cleaning a tree', () => {
  const parent = mkdtempSync(join(tmpdir(), 'prepared-path-limits-'))
  try {
    const cases = [
      { entries: [{ path: '../x', contents: '' }] },
      { entries: [{ path: 'a/b/c/d/e', contents: '' }] },
      { entries: [{ path: 'a//b', contents: '' }] },
      { entries: [{ path: 'a', contents: '' }, { path: 'a/b', contents: '' }] },
      { entries: [{ path: 'A', contents: '' }, { path: 'a', contents: '' }] },
      { entries: [{ path: 'A/a', contents: '' }, { path: 'a/b', contents: '' }] },
      { entries: [{ path: 'MANIFEST.JSON', contents: '' }] },
      { entries: [], directories: ['manifest.pending.json/child'] },
      { entries: [{ path: 'Images/a', contents: '' }], directories: ['images'] },
      { entries: [], directories: ['Images', 'images'] },
      { entries: Array.from({ length: completedArtifactLimits.files + 1 }, (_, i) => ({ path: `${i}`, contents: '' })) },
    ]
    for (const fixture of cases) expect(() => prepareCompletedArtifactDirectorySync(join(parent, 'invalid'), fixture.entries, '{}', { directories: fixture.directories })).toThrow()
    const bytes = new Uint8Array(completedArtifactLimits.bytes / completedArtifactLimits.files)
    expect(() => prepareCompletedArtifactDirectorySync(join(parent, 'invalid'), Array.from({ length: completedArtifactLimits.files }, (_, i) => ({ path: `${i}`, contents: bytes })), '{}')).toThrow('byte limit')
    expect(() => prepareCompletedArtifactDirectorySync(join(parent, 'invalid'), [], JSON.stringify({ label: 'é'.repeat(completedArtifactLimits.manifestBytes / 2) }))).toThrow('manifest byte limit')
    expect(() => prepareCompletedArtifactDirectorySync(join(parent, 'invalid'), [], '[]')).toThrow('JSON object')
    expect(readdirSync(parent)).toEqual([])
    const directory = join(parent, 'existing')
    mkdirSync(directory)
    writeFileSync(join(directory, 'sentinel'), 'untouched')
    expect(() => prepareCompletedArtifactDirectorySync(directory, [], '{}')).toThrow('EEXIST')
    expect(readFileSync(join(directory, 'sentinel'), 'utf8')).toBe('untouched')
    expect(readdirSync(directory)).toEqual(['sentinel'])
  }
  finally { rmSync(parent, { recursive: true, force: true }) }
})

test('a canonical parent alias and another prepared sibling preserve independent live handles', () => {
  const parent = realpathSync(mkdtempSync(join(tmpdir(), 'prepared-parent-alias-')))
  try {
    const alias = join(parent, 'parent-alias')
    mkdirSync(join(parent, 'owned'))
    symlinkSync(join(parent, 'owned'), alias)
    const first = prepareCompletedArtifactDirectorySync(join(alias, 'first'), [], '{}')
    const second = prepareCompletedArtifactDirectorySync(join(alias, 'second'), [], '{}')
    expect(first.receipt.directory).toBe(join(parent, 'owned/first'))
    expect(first.receipt.lexicalDirectory).toBe(join(alias, 'first'))
    expect(first.publishSync().directory).toBe(join(parent, 'owned/first'))
    expect(second.publishSync().directory).toBe(join(parent, 'owned/second'))
    // A lexical ancestor may be canonicalized, but an existing final symlink is never adopted.
    symlinkSync(join(parent, 'owned/first'), join(parent, 'target-alias'))
    expect(() => prepareCompletedArtifactDirectorySync(join(parent, 'target-alias'), [], '{}')).toThrow('EEXIST')
  }
  finally { rmSync(parent, { recursive: true, force: true }) }
})

for (const tamper of ['root', 'subdirectory', 'file', 'pending', 'nonempty', 'hardlink', 'mode', 'restored-mode', 'write-truncate', 'symlink', 'missing', 'unexpected', 'completed', 'parent-alias'] as const) {
  test(`publication refuses ${tamper} tampering before private bytes and consumes the handle`, () => {
    const parent = realpathSync(mkdtempSync(join(tmpdir(), 'prepared-tamper-')))
    try {
      const directory = join(parent, 'result')
      const sentinel = join(parent, 'sentinel')
      writeFileSync(sentinel, 'independent sentinel')
      const prepared = prepareCompletedArtifactDirectorySync(directory, [{ path: 'a.bin', contents: 'private payload' }, { path: 'nested/b.bin', contents: 'another private payload' }], '{"private":"manifest"}')
      const file = join(directory, 'a.bin'), pending = join(directory, 'manifest.pending.json')
      if (tamper === 'root') { renameSync(directory, `${directory}-original`); mkdirSync(directory, { mode: 0o700 }) }
      if (tamper === 'subdirectory') { renameSync(join(directory, 'nested'), join(parent, 'original-subdirectory')); mkdirSync(join(directory, 'nested'), { mode: 0o700 }); writeFileSync(join(directory, 'nested/b.bin'), '', { mode: 0o600 }) }
      if (tamper === 'file' || tamper === 'pending') { const path = tamper === 'file' ? file : pending; renameSync(path, join(parent, 'original-file')); writeFileSync(path, '', { flag: 'wx', mode: 0o600 }) }
      if (tamper === 'nonempty') writeFileSync(file, 'keep this unrelated content')
      if (tamper === 'hardlink') linkSync(file, join(parent, 'extra-link'))
      if (tamper === 'mode') chmodSync(file, 0o644)
      if (tamper === 'restored-mode') { chmodSync(file, 0o644); chmodSync(file, 0o600) }
      if (tamper === 'write-truncate') { writeFileSync(file, 'changed'); truncateSync(file, 0) }
      if (tamper === 'symlink') { unlinkSync(file); symlinkSync(sentinel, file) }
      if (tamper === 'missing') rmSync(directory, { recursive: true })
      if (tamper === 'unexpected') writeFileSync(join(directory, 'unexpected'), '')
      if (tamper === 'completed') writeFileSync(join(directory, 'manifest.json'), 'independent completed sentinel')
      if (tamper === 'parent-alias') { renameSync(parent, `${parent}-moved`); symlinkSync(`${parent}-moved`, parent) }
      expect(() => prepared.publishSync()).toThrow()
      expect(() => prepared.publishSync()).toThrow('consumed')
      expect(readFileSync(sentinel, 'utf8')).toBe('independent sentinel')
      if (tamper === 'missing') expect(existsSync(directory)).toBe(false)
      else {
        const original = tamper === 'root' ? `${directory}-original` : directory
        const second = tamper === 'subdirectory' ? join(parent, 'original-subdirectory/b.bin') : join(original, 'nested/b.bin')
        expect(readFileSync(second).byteLength).toBe(0)
        if (tamper === 'nonempty') expect(readFileSync(file, 'utf8')).toBe('keep this unrelated content')
        if (tamper === 'completed') expect(readFileSync(join(directory, 'manifest.json'), 'utf8')).toBe('independent completed sentinel')
      }
    }
    finally {
      rmSync(parent, { recursive: true, force: true })
      rmSync(`${parent}-moved`, { recursive: true, force: true })
    }
  })
}

test('the one-shot writer still returns a Promise and yields while asynchronous filesystem publication is pending', async () => {
  const parent = mkdtempSync(join(tmpdir(), 'artifact-async-contract-'))
  try {
    const directory = join(parent, 'artifact')
    const pending = writeCompletedArtifact(directory, [{ path: 'data', contents: 'bytes' }], '{}')
    expect(pending).toBeInstanceOf(Promise)
    // Real async mkdir has not yet progressed to any payload or completion when the call returns.
    expect(existsSync(join(directory, 'data'))).toBe(false)
    expect(existsSync(join(directory, 'manifest.json'))).toBe(false)
    let completed = false
    const result = pending.then(value => { completed = true; return value })
    await Promise.resolve()
    expect(completed).toBe(false)
    await result
    expect(readFileSync(join(directory, 'data'), 'utf8')).toBe('bytes')
  }
  finally { rmSync(parent, { recursive: true, force: true }) }
})

test('FIFO replacement refuses without opening a blocking writer or touching a sentinel', () => {
  const parent = realpathSync(mkdtempSync(join(tmpdir(), 'prepared-fifo-')))
  try {
    const prepared = prepareCompletedArtifactDirectorySync(join(parent, 'artifact'), [{ path: 'data', contents: 'private' }], '{}')
    const path = prepared.receipt.files[0]!.path
    unlinkSync(path)
    const fifo = Bun.spawnSync(['mkfifo', path], { stdout: 'pipe', stderr: 'pipe' })
    expect(fifo.exitCode, fifo.stderr.toString()).toBe(0)
    const start = performance.now()
    expect(() => prepared.publishSync()).toThrow('type')
    expect(performance.now() - start).toBeLessThan(1000)
    expect(lstatSync(path).isFIFO()).toBe(true)
    expect(lstatSync(prepared.receipt.pendingManifest.path).size).toBe(0)
    expect(existsSync(prepared.receipt.completedManifest)).toBe(false)
  }
  finally { rmSync(parent, { recursive: true, force: true }) }
})

function openArtifactDescriptors(parent: string): string[] {
  if (existsSync('/proc/self/fd')) {
    return readdirSync('/proc/self/fd').flatMap(fd => {
      try { const path = readlinkSync(`/proc/self/fd/${fd}`); return path.startsWith(`${parent}/`) ? [path] : [] }
      catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []; throw error }
    })
  }
  const result = Bun.spawnSync(['lsof', '-a', '-p', String(process.pid), '-Fn'], { stdout: 'pipe', stderr: 'pipe' })
  expect(result.exitCode, result.stderr.toString()).toBe(0)
  return result.stdout.toString().split('\n').filter(line => line.startsWith(`n${parent}/`))
}

test('real descriptor inspection confirms closure after prepare, publication and native errors', () => {
  const parent = realpathSync(mkdtempSync(join(tmpdir(), 'prepared-descriptors-')))
  try {
    const probe = join(parent, 'positive-open-descriptor')
    writeFileSync(probe, '')
    const fd = openSync(probe, 'r')
    try { expect(openArtifactDescriptors(parent).length).toBeGreaterThan(0) }
    finally { closeSync(fd) }
    expect(openArtifactDescriptors(parent)).toEqual([])
    const prepared = prepareCompletedArtifactDirectorySync(join(parent, 'good'), [{ path: 'data', contents: 'private' }], '{}')
    expect(openArtifactDescriptors(parent)).toEqual([])
    prepared.publishSync()
    expect(openArtifactDescriptors(parent)).toEqual([])
    const changed = prepareCompletedArtifactDirectorySync(join(parent, 'changed'), [{ path: 'data', contents: 'private' }], '{}')
    chmodSync(changed.receipt.files[0]!.path, 0o644)
    expect(() => changed.publishSync()).toThrow()
    expect(openArtifactDescriptors(parent)).toEqual([])
    expect(() => prepareCompletedArtifactDirectorySync(join(parent, 'good'), [], '{}')).toThrow('EEXIST')
    expect(openArtifactDescriptors(parent)).toEqual([])
    // An actual private-mode failure retains an empty partial root and closes any opened descriptor.
    const oldMask = process.umask(0o777)
    try { expect(() => prepareCompletedArtifactDirectorySync(join(parent, 'partial'), [], '{}')).toThrow() }
    finally { process.umask(oldMask); chmodSync(join(parent, 'partial'), 0o700) }
    expect(readdirSync(join(parent, 'partial'))).toEqual([])
    expect(openArtifactDescriptors(parent)).toEqual([])
  }
  finally { rmSync(parent, { recursive: true, force: true }) }
})

for (const stage of ['prepared', 'payload', 'manifest'] as const) {
  test(`real child interruption preserves classified ${stage} state without reporting completion`, async () => {
    const parent = realpathSync(mkdtempSync(join(tmpdir(), 'prepared-artifact-interrupt-')))
    let child: ReturnType<typeof Bun.spawn> | undefined
    try {
      const config = join(parent, 'bunfig.toml')
      writeFileSync(config, 'preload=[]\n')
      const process = Bun.spawn([Bun.which('bun')!, `--config=${config}`, '--no-env-file', join(import.meta.dir, 'fixtures/prepared-artifact-child.ts'), parent, stage], { stdin: 'pipe', stdout: 'pipe', stderr: 'pipe' })
      child = process
      const output = process.stdout.getReader()
      const ready = await output.read()
      expect(new TextDecoder().decode(ready.value)).toContain('READY')
      const receipt = JSON.parse(readFileSync(join(parent, 'receipt.json'), 'utf8')) as PreparedCompletedArtifactReceipt
      if (stage === 'manifest') expect(receipt.pendingManifest.bytes).toBe(completedArtifactLimits.manifestBytes)
      expect(existsSync(receipt.completedManifest)).toBe(false)
      const identity = lstatSync(receipt.pendingManifest.path, { bigint: true })
      expect(identity.ino.toString()).toBe(receipt.pendingManifest.ino)
      if (stage !== 'prepared') {
        process.stdin.write('publish\n')
        process.stdin.end()
        const deadline = Date.now() + 5000
        let observed = false
        while (Date.now() < deadline && process.exitCode === null) {
          const pending = existsSync(receipt.pendingManifest.path) ? lstatSync(receipt.pendingManifest.path).size : -1
          const payload = lstatSync(receipt.files[0]!.path).size
          if (!existsSync(receipt.completedManifest) && (stage === 'payload' ? payload > 0 && pending === 0 : pending > 0)) {
            process.kill('SIGSTOP')
            observed = true
            break
          }
          await Bun.sleep(1)
        }
        expect(observed, `missed ${stage} interruption window`).toBe(true)
      }
      process.kill('SIGKILL')
      expect(await process.exited).not.toBe(0)
      let rest = ''
      for (;;) { const chunk = await output.read(); if (chunk.done) break; rest += new TextDecoder().decode(chunk.value) }
      expect(rest).not.toContain('COMPLETED')
      expect(await new Response(process.stderr).text()).toBe('')
      expect(existsSync(receipt.completedManifest)).toBe(false)
      expect(lstatSync(receipt.pendingManifest.path, { bigint: true }).ino.toString()).toBe(receipt.pendingManifest.ino)
      if (stage === 'prepared') for (const file of [...receipt.files, receipt.pendingManifest]) expect(lstatSync(file.path).size).toBe(0)
      if (stage === 'payload') {
        const first = readFileSync(receipt.files[0]!.path)
        expect(first.byteLength).toBeGreaterThan(0)
        expect(first.every(byte => byte === 90)).toBe(true)
        expect(lstatSync(receipt.pendingManifest.path).size).toBe(0)
      }
      if (stage === 'manifest') expect(lstatSync(receipt.pendingManifest.path).size).toBeGreaterThan(0)
    }
    finally {
      if (child) { if (child.exitCode === null) child.kill('SIGKILL'); await child.exited }
      rmSync(parent, { recursive: true, force: true })
    }
  }, 15000)
}

test('bounded 32 MiB and maximum-file publication block the isolate and report native timings', async () => {
  const parent = realpathSync(mkdtempSync(join(tmpdir(), 'prepared-latency-')))
  try {
    let timerFired = false
    const timer = setTimeout(() => { timerFired = true }, 0)
    const measurements: { shape: string, prepareMs: number, publishMs: number }[] = []
    try {
      for (const shape of ['32MiB', '1024-files']) {
        const entries = shape === '32MiB' ? [{ path: 'data.bin', contents: new Uint8Array(32 * 1024 * 1024).fill(90) }] : Array.from({ length: completedArtifactLimits.files }, (_, index) => ({ path: `${index}.bin`, contents: '' }))
        const start = performance.now()
        const prepared = prepareCompletedArtifactDirectorySync(join(parent, shape), entries, '{}')
        const preparedAt = performance.now()
        prepared.publishSync()
        measurements.push({ shape, prepareMs: preparedAt - start, publishMs: performance.now() - preparedAt })
        expect(timerFired).toBe(false)
      }
      await Bun.sleep(1)
      expect(timerFired).toBe(true)
    }
    finally { clearTimeout(timer) }
    // eslint-disable-next-line no-console
    console.log('Prepared artifact native timing', JSON.stringify({ platform: process.platform, measurements }))
  }
  finally { rmSync(parent, { recursive: true, force: true }) }
}, 15000)

test('exact 128 MiB accounting succeeds as zero metadata while one extra byte refuses before mutation', () => {
  const parent = realpathSync(mkdtempSync(join(tmpdir(), 'prepared-exact-cap-')))
  try {
    const unit = new Uint8Array(completedArtifactLimits.bytes / completedArtifactLimits.files)
    const entries = Array.from({ length: completedArtifactLimits.files }, (_, index) => ({ path: `${index}.bin`, contents: index === completedArtifactLimits.files - 1 ? unit.subarray(0, unit.length - 1) : unit }))
    expect(() => prepareCompletedArtifactDirectorySync(join(parent, 'over'), entries, '{}')).toThrow('byte limit')
    expect(readdirSync(parent)).toEqual([])
    entries[entries.length - 1]!.contents = unit.subarray(0, unit.length - 2)
    const prepared = prepareCompletedArtifactDirectorySync(join(parent, 'exact'), entries, '{}')
    expect(prepared.receipt.files.reduce((sum, file) => sum + file.bytes, prepared.receipt.pendingManifest.bytes)).toBe(completedArtifactLimits.bytes)
    expect(prepared.receipt.files.length).toBe(completedArtifactLimits.files)
    for (const file of [...prepared.receipt.files, prepared.receipt.pendingManifest]) expect(lstatSync(file.path).size).toBe(0)
    expect(existsSync(prepared.receipt.completedManifest)).toBe(false)
  }
  finally { rmSync(parent, { recursive: true, force: true }) }
}, 15000)
