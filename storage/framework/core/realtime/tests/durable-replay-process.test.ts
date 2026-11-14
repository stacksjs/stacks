import { expect, test } from 'bun:test'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { withDisposableDatabase, disposablePostgresUrl } from '../../testing/src/disposable-database'

// Public SQL store in independent OS processes catches transaction ordering,
// crash rollback and restart durability. It does not qualify live fan-out.
for (const dialect of ['sqlite', 'postgres'] as const) test.skipIf(dialect === 'postgres' && !disposablePostgresUrl())(`durable replay survives independent ${dialect} workers and crash rollback`, async () => {
  await withDisposableDatabase(dialect, async database => {
    const config = resolve(database.directory, 'bunfig.toml'), workers = new Set<ReturnType<typeof Bun.spawn>>()
    await Bun.write(config, '[test]\npreload = []\n')
    function start(mode: string, input: Record<string, unknown> = {}) {
      const child = Bun.spawn([process.execPath, `--config=${config}`, '--no-env-file', resolve(import.meta.dir, 'fixtures/durable-replay-worker.ts'), mode, JSON.stringify(input)], { cwd: resolve(import.meta.dir, 'fixtures/replay-app'), env: { ...process.env, ...database.env, APP_ENV: 'test' }, stdout: 'pipe', stderr: 'pipe' })
      workers.add(child)
      const text = new Response(child.stdout).text(), errors = new Response(child.stderr).text()
      return { child, async result() { const timer = setTimeout(() => child.kill(9), 30000); try { const [code, stdout, stderr] = await Promise.all([child.exited, text, errors]); if (code !== 0) throw new Error(`Replay worker failed (${code}): ${stderr}\n${stdout}`); return JSON.parse(stdout.trim().split('\n').at(-1)!) as any } finally { clearTimeout(timer); workers.delete(child) } } }
    }
    const run = (mode: string, input: Record<string, unknown> = {}) => start(mode, input).result()
    async function waitFile(path: string) { const end = Date.now() + 20000; while (!existsSync(path)) { if (Date.now() > end) throw new Error('Replay worker barrier timed out'); await Bun.sleep(5) } }
    try {
      expect((await run('migrate')).migrated).toBe(true)
      const first = await run('append', { operation: 'first' })
      expect(first.message.seq).toBe(1)
      await expect(run('append', { operation: 'first', data: { different: true } })).rejects.toThrow('different event data')
      const ready = resolve(database.directory, 'ready'), release = resolve(database.directory, 'release'), started = resolve(database.directory, 'started')
      const held = start('append', { operation: 'held', ready, release })
      await waitFile(ready)
      const racing = start('append', { operation: 'racing', started })
      await waitFile(started)
      const replay = start('read', { after: first.cursor })
      await Bun.sleep(100)
      expect(racing.child.exitCode).toBeNull()
      expect(replay.child.exitCode).toBeNull()
      await Bun.write(release, 'commit')
      const [a, b, page] = await Promise.all([held.result(), racing.result(), replay.result()])
      expect([a.message.seq, b.message.seq]).toEqual([2, 3])
      expect(page.messages.map((message: any) => message.seq)).toEqual(Array.from({ length: page.head.seq - 1 }, (_, index) => index + 2))
      expect(page.cursor.seq).toBe(page.head.seq)
      const restarted = await run('read')
      expect(restarted.messages.map((message: any) => message.seq)).toEqual([1, 2, 3])
      expect(restarted.head.incarnation).toBe(first.cursor.incarnation)
      const crashReady = resolve(database.directory, 'crash-ready'), crashRelease = resolve(database.directory, 'crash-release')
      const crashed = start('append', { operation: 'crashed', ready: crashReady, release: crashRelease })
      await waitFile(crashReady); crashed.child.kill(9); await crashed.child.exited; workers.delete(crashed.child)
      const afterCrash = await run('append', { operation: 'after-crash' })
      expect(afterCrash.message.seq).toBe(4)
      expect((await run('rollback', { operation: 'rolled-back' })).rolledBack).toBe(true)
      expect((await run('append', { operation: 'after-rollback' })).message.seq).toBe(5)
      const concurrent = await Promise.all(Array.from({ length: 8 }, (_, index) => run('append', { operation: index < 4 ? 'same-operation' : `unique-${index}` })))
      expect(concurrent.filter(result => result.duplicate).length).toBe(3)
      const complete = await run('read')
      expect(complete.messages.map((message: any) => message.seq)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
      const native = await run('append', { native: true, operation: 'native-database' })
      expect(native.message.seq).toBe(11)
      expect((await run('read', { native: true, after: complete.cursor })).messages.map((item: any) => item.seq)).toEqual([11])
      expect((await run('read', { workspace: 2, project: 2 })).messages).toEqual([])
      expect((await run('read', { workspace: 2, project: 2, after: complete.cursor })).gap).toBe('incarnation')
      const policy = { maxEvents: 2, ttlMs: 10 }, retention = { channel: 'private-retained.1', policy }
      const retainedFirst = await run('append', { ...retention, operation: 'retained-1', now: 1000 })
      const retainedSecond = await run('append', { ...retention, operation: 'retained-2', now: 1001 })
      await run('append', { ...retention, operation: 'retained-3', now: 1002 })
      const evicted = await run('read', { ...retention, now: 1003 })
      expect(evicted.gap).toBe('retention'); expect(evicted.prunedThrough).toBe(1); expect(evicted.messages).toEqual([])
      expect((await run('read', { ...retention, now: 1003, after: retainedFirst.cursor, limit: 1 })).messages.map((item: any) => item.seq)).toEqual([2])
      expect((await run('read', { ...retention, now: 1011, after: retainedSecond.cursor })).messages.map((item: any) => item.seq)).toEqual([3])
      expect((await run('read', { ...retention, now: 1012, after: retainedSecond.cursor })).gap).toBe('retention')
      const pastWindow = await run('append', { ...retention, operation: 'retained-1', now: 1013 })
      expect(pastWindow.duplicate).toBe(false); expect(pastWindow.message.seq).toBe(4)
      await expect(run('read', { ...retention, policy: { ...policy, maxEvents: 3 }, now: 1013 })).rejects.toThrow('policy')
      expect((await run('read', { ...retention, now: 1013, after: { ...pastWindow.cursor, seq: 100 } })).gap).toBe('cursor_ahead')
      await run('delete')
      const recreated = await run('append', { operation: 'new-incarnation' })
      expect(recreated.message.seq).toBe(1)
      expect(recreated.cursor.incarnation).not.toBe(first.cursor.incarnation)
      const stale = await run('read', { after: first.cursor })
      expect(stale.gap).toBe('incarnation'); expect(stale.cursor).toBeNull(); expect(stale.messages).toEqual([])
    }
    finally { for (const worker of workers) { if (worker.exitCode === null) worker.kill(9); await worker.exited } }
  }, { prefix: 'stacks_replay' })
}, 120000)
