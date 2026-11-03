import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { SQL } from 'bun'
import { expect, test } from 'bun:test'

// onOneServer() runs a slot once across servers, not once per server whose
// tick lands after the first one finished (stacksjs/stacks#3152). Each server
// is a process of its own with its own lock directory; they share a database.
for (const dialect of ['postgres', 'mysql'] as const) {
  const connection = dialect === 'postgres' ? process.env.STACKS_TEST_POSTGRES_URL : process.env.STACKS_TEST_MYSQL_URL
  test.skipIf(!connection)(`${dialect}: onOneServer() runs each slot on one server`, async () => {
    const url = new URL(connection!)
    if (!['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname))
      throw new Error('Scheduler slot tests require a local disposable database server')
    const directory = await mkdtemp(join(tmpdir(), 'stacks-one-server-'))
    const name = `stacks_one_server_${crypto.randomUUID().replaceAll('-', '')}`
    const quoted = dialect === 'mysql' ? `\`${name}\`` : `"${name}"`
    const admin = new SQL(url.href)
    const own = new URL(url.href)
    own.pathname = `/${name}`
    let created = false
    let database: SQL | undefined
    try {
      const config = join(directory, 'bunfig.toml')
      await writeFile(config, 'preload = []\n')
      await admin.unsafe(`CREATE DATABASE ${quoted}`)
      created = true
      database = new SQL(own.href)
      await database.unsafe('CREATE TABLE runs (server VARCHAR(8) NOT NULL)')

      const server = async (serverName: 'A' | 'B', mode: 'tick' | 'missed', task: string, slot: number): Promise<string> => {
        const child = Bun.spawn([process.execPath, `--config=${config}`, '--no-env-file', join(import.meta.dir, 'fixtures/one-server-slot.ts')], {
          env: {
            ...process.env, APP_ENV: 'test', DB_CONNECTION: dialect, DB_QUERY_LOGGING_ENABLED: 'false',
            DB_DATABASE: name, DB_HOST: url.hostname, DB_PORT: url.port || (dialect === 'mysql' ? '3306' : '5432'),
            DB_USERNAME: decodeURIComponent(url.username), DB_PASSWORD: decodeURIComponent(url.password),
            DB_SSL: url.searchParams.get('ssl') === 'true' ? 'true' : 'false',
            ONE_SERVER_MODE: mode, ONE_SERVER_NAME: serverName, ONE_SERVER_TASK: task, ONE_SERVER_SLOT: String(slot),
          },
          stdout: 'pipe', stderr: 'pipe',
        })
        const watchdog = setTimeout(() => child.kill(), 20_000)
        try {
          const [code, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()])
          expect(code, `${stdout}\n${stderr}`).toBe(0)
          expect(stdout).toContain(`server ${serverName} done`)
          output.push(`--- server ${serverName} (${mode})\n${stdout}${stderr}`)
          return stdout
        }
        finally { clearTimeout(watchdog) }
      }
      // Each server's own output, for an assertion that fails without either
      // process exiting non-zero.
      const output: string[] = []
      const runs = async (): Promise<string[]> => {
        const rows = await database!.unsafe('SELECT server FROM runs') as Array<{ server: string }>
        await database!.unsafe('DELETE FROM runs')
        return rows.map(row => row.server).sort()
      }
      const slot = (Math.floor(Date.now() / 60_000) + 10) * 60_000

      // The live tick for the same slot, B's landing after A's task ended and
      // released the lock, as a server a few hundred ms behind does. Before
      // the claim, both ran it.
      await server('A', 'tick', 'nightly-billing', slot)
      await server('B', 'tick', 'nightly-billing', slot)
      expect(await runs(), output.join('\n')).toEqual(['A'])

      // A catch-up on two servers that booted one after the other: the second
      // replays nothing the first already ran.
      expect(await server('A', 'missed', 'digest', slot)).toContain('fired 3')
      expect(await server('B', 'missed', 'digest', slot)).toContain('fired 0')
      expect(await runs(), output.join('\n')).toEqual(['A', 'A', 'A'])

      const claims = await database.unsafe('SELECT COUNT(*) AS n FROM scheduler_claims') as Array<{ n: number | string | bigint }>
      expect(Number(claims[0]!.n)).toBe(4)
    }
    finally {
      try {
        await database?.close()
        if (created) await admin.unsafe(`DROP DATABASE ${quoted}${dialect === 'postgres' ? ' WITH (FORCE)' : ''}`)
      }
      finally {
        try { await admin.close() }
        finally { await rm(directory, { recursive: true, force: true }) }
      }
    }
  }, 60_000)
}
