/**
 * The dump that stands between a bad migration and the only copy of an app's
 * data (stacksjs/stacks#2313).
 *
 * `buddy deploy` runs `migrate` against production on every release. #2318 made
 * the framework say that nothing was backing it up; this covers the half that
 * does something about it - the pre-migration dump, its retention, and the
 * restore path.
 *
 * The SQLite round-trip is a REAL one: rows are written, dumped, destroyed, and
 * read back. A backup nobody has ever restored is a hypothesis, so a test that
 * only checked a file appeared would be testing the same hypothesis.
 */

import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { Database } from 'bun:sqlite'
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import process from 'node:process'
import { Buffer } from 'node:buffer'
import {
  backupFileName,
  DEFAULT_DUMP_TIMEOUT_SECONDS,
  DEFAULT_RETAIN,
  dumpCommand,
  dumpSqlite,
  isBackupFileName,
  isCompressedBackup,
  prunableBackups,
  readDump,
  resolveBackupTarget,
  backupObjectKey,
  parseBackupDestination,
  resolveBackupDestination,
  resolveBackupRetain,
  resolveBackupTimeout,
  restoreCommand,
  restoreSqlite,
  toolFailureDetail,
  withoutPassword,
  writeDump,
} from '../src/database-backup'

let dir: string

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'stacks-2313-'))
})

afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
})

function sqliteConfig(database: string): unknown {
  return { default: 'sqlite', connections: { sqlite: { database } } }
}

describe('which database a dump is taken of', () => {
  it('reads SQLite out of the connection the app actually opens', () => {
    expect(resolveBackupTarget(sqliteConfig('database/stacks.sqlite'))).toEqual({
      engine: 'sqlite',
      database: 'database/stacks.sqlite',
    })
  })

  it('reads a server engine with its credentials', () => {
    const target = resolveBackupTarget({
      default: 'postgres',
      connections: { postgres: { name: 'app', host: 'db.internal', port: 6543, username: 'app', password: 'hunter2' } },
    })

    expect(target).toEqual({
      engine: 'postgres',
      database: 'app',
      host: 'db.internal',
      port: 6543,
      username: 'app',
      password: 'hunter2',
    })
  })

  it('treats mariadb as mysql, because that is the wire protocol and the tool', () => {
    expect(resolveBackupTarget({ default: 'mariadb', connections: { mariadb: { name: 'app' } } })?.engine).toBe('mysql')
  })

  it('refuses vitess rather than take a dump that would not restore', () => {
    // A `mysqldump` through a vtgate is not a restorable backup of a sharded
    // keyspace. Producing one would look like a backup right up to the restore,
    // which is worse than producing nothing.
    expect(resolveBackupTarget({ default: 'vitess', connections: { vitess: { name: 'app' } } })).toBeNull()
  })

  it('refuses an engine it has no dump tool for at all', () => {
    expect(resolveBackupTarget({ default: 'dynamodb', connections: { dynamodb: {} } })).toBeNull()
  })

  it('survives a config with nothing in it', () => {
    // Runs inside a deploy. Throwing here would fail the release rather than
    // the backup.
    expect(resolveBackupTarget(undefined)).toBeNull()
    expect(resolveBackupTarget({})).toBeNull()
    expect(resolveBackupTarget({ default: 'sqlite', connections: {} })).toBeNull()
    expect(resolveBackupTarget({ default: 'sqlite', connections: { sqlite: { database: '' } } })).toBeNull()
  })
})

describe('the dump command', () => {
  const target = resolveBackupTarget({
    default: 'postgres',
    connections: { postgres: { name: 'app', host: '10.0.0.5', port: 5432, username: 'app', password: 's3cret' } },
  })!

  it('keeps the password out of argv, where every user on the box could read it', () => {
    const command = dumpCommand(target)!

    expect(command.args.join(' ')).not.toContain('s3cret')
    expect(command.env.PGPASSWORD).toBe('s3cret')
  })

  it('connects as the application user, so no superuser rule has to be copied here', () => {
    // ts-cloud encodes pantry's postgres trust/md5 asymmetry in an unexported
    // `pgAdminCommand()`. Dumping the one database the app owns, as the app,
    // needs none of it.
    const command = dumpCommand(target)!

    expect(command.bin).toBe('pg_dump')
    expect(command.args).toContain('app')
    expect(command.args).not.toContain('postgres')
  })

  it('drops ownership and ACLs, so the dump restores onto a fresh box', () => {
    const command = dumpCommand(target)!

    expect(command.args).toContain('--no-owner')
    expect(command.args).toContain('--no-acl')
  })

  it('dumps mysql in one transaction rather than table by table', () => {
    const mysql = resolveBackupTarget({ default: 'mysql', connections: { mysql: { name: 'app', password: 'pw' } } })!
    const command = dumpCommand(mysql)!

    expect(command.bin).toBe('mysqldump')
    expect(command.args).toContain('--single-transaction')
    expect(command.env.MYSQL_PWD).toBe('pw')
    expect(command.args.join(' ')).not.toContain('pw')
  })

  it('has no external command for SQLite, which is copied in-process', () => {
    expect(dumpCommand({ engine: 'sqlite', database: 'a.sqlite' })).toBeNull()
  })

  it('stops a postgres restore at the first error instead of half-applying it', () => {
    const command = restoreCommand(target)!

    expect(command.bin).toBe('psql')
    expect(command.args.join(' ')).toContain('ON_ERROR_STOP=1')
  })

  it('prints the dump rather than writing it, so it can be compressed on the way to disk', () => {
    // A `--file` or `--result-file` here would write an uncompressed copy that
    // writeDump never sees, which is what filled a box (#3079).
    const mysql = resolveBackupTarget({ default: 'mysql', connections: { mysql: { name: 'app' } } })!
    for (const command of [dumpCommand(target)!, dumpCommand(mysql)!, restoreCommand(target)!, restoreCommand(mysql)!]) {
      expect(command.args.some(arg => arg === '--file' || arg.startsWith('--result-file') || arg.startsWith('--execute'))).toBe(false)
    }
  })
})

/** A stand-in for pg_dump or psql: a real process with real pipes and exit codes. */
function tool(script: string): { bin: string, args: string[], env: Record<string, string> } {
  return { bin: 'sh', args: ['-c', script], env: {} }
}

// Every promise the dump plumbing makes is held to both ways of moving the
// bytes: the kernel pipe a box with bash and gzip gets, and the in-process
// path every other box gets. Neither is the fallback as far as a restore is
// concerned.
const PLUMBING = (process.platform === 'win32' ? ['process'] : ['pipe', 'process']) as Array<'pipe' | 'process'>

describe.each(PLUMBING)('a server dump, compressed and put back (%s)', (via) => {
  const sql = 'INSERT INTO t VALUES (1, \'row\');\n'.repeat(2000)

  it('gzips what the tool prints, and restores it byte for byte', async () => {
    const destination = join(dir, backupFileName({ engine: 'postgres', database: 'app' }, new Date('2026-08-13T09:00:00.000Z')))
    const source = join(dir, 'source.sql')
    writeFileSync(source, sql)

    await writeDump(tool(`cat '${source}'`), destination, undefined, { via })

    const written = await Bun.file(destination).bytes()
    expect([written[0], written[1]]).toEqual([0x1F, 0x8B]) // the gzip magic number
    expect(written.length).toBeLessThan(sql.length / 5)
    expect(new TextDecoder().decode(Bun.gunzipSync(written))).toBe(sql)

    const restored = join(dir, 'restored.sql')
    await readDump(tool(`cat > '${restored}'`), destination, undefined, { via })
    expect(await Bun.file(restored).text()).toBe(sql)
  })

  // The dump that hung every deploy was 1.36 GB (database-backup-min-bun.test.ts
  // runs this under the Bun it hung on). 64 MB is thousands of pipe buffers,
  // which is enough for a writer that stalls or loses a chunk to show it.
  it('takes a dump far larger than any buffer and puts every byte back', async () => {
    const megabytes = 64
    const row = 'INSERT INTO events VALUES (424242, \'c0ffee\');'.padEnd(127, ' ')
    const produce = `yes "${row}" | head -n ${megabytes * 8192}`
    const destination = join(dir, '2026-08-13T09-00-00-000.postgres.sql.gz')
    const sum = join(dir, 'restored.cksum')

    await writeDump(tool(produce), destination, undefined, { via })
    await readDump(tool(`cksum > '${sum}'`), destination, undefined, { via })

    const expected = new TextDecoder().decode(Bun.spawnSync(['sh', '-c', `${produce} | cksum`]).stdout)
    expect(expected).toContain(String(megabytes * 1024 * 1024))
    expect(await Bun.file(sum).text()).toBe(expected)
  }, 60_000)

  it('writes a dump of nothing as a gzip file, not as an empty one', async () => {
    const destination = join(dir, '2026-08-13T09-00-00-000.postgres.sql.gz')
    await writeDump(tool('true'), destination, undefined, { via })

    expect(Bun.gunzipSync(await Bun.file(destination).bytes()).length).toBe(0)
  })

  it('leaves nothing behind when the tool fails halfway, so a broken dump is never the newest', async () => {
    const destination = join(dir, '2026-08-13T09-00-00-000.postgres.sql.gz')

    await expect(writeDump(tool(`printf 'half a dump'; echo 'pg_dump: error: connection lost' >&2; exit 1`), destination, undefined, { via }))
      .rejects.toThrow('connection lost')
    expect(existsSync(destination)).toBe(false)
    expect(existsSync(`${destination}.partial`)).toBe(false)
  })

  it('keeps the password out of a failed dump\'s message', async () => {
    const destination = join(dir, '2026-08-13T09-00-00-000.postgres.sql.gz')
    const failing = tool(`echo 'pg_dump: error: password "hunter2" rejected' >&2; exit 1`)

    const error = await writeDump(failing, destination, 'hunter2', { via }).catch(e => e as Error)
    expect(error.message).toContain('password "***" rejected')
    expect(error.message).not.toContain('hunter2')
  })

  it('reports a dump that cannot be written, and leaves the tool nowhere to keep running', async () => {
    const destination = join(dir, 'no-such-directory', '2026-08-13T09-00-00-000.postgres.sql.gz')

    await expect(writeDump(tool(`yes 'INSERT' | head -n 200000`), destination, undefined, { via }))
      .rejects.toThrow(/no such file or directory/i)
  })

  it('stops a dump that outlives its deadline, says so, and leaves no process and no file', async () => {
    const destination = join(dir, '2026-08-13T09-00-00-000.postgres.sql.gz')
    const pidFile = join(dir, 'tool.pid')
    // exec, so the pid written is the process that would otherwise live on.
    const stuck = tool(`echo $$ > '${pidFile}'; printf 'some of a dump'; exec sleep 300`)

    const started = Date.now()
    await expect(writeDump(stuck, destination, undefined, { via, timeoutMs: 500 }))
      .rejects.toThrow(/sh had not finished after 0\.5s.*DB_BACKUP_TIMEOUT/)
    expect(Date.now() - started).toBeLessThan(10_000)

    expect(existsSync(destination)).toBe(false)
    expect(existsSync(`${destination}.partial`)).toBe(false)

    const pid = Number((await Bun.file(pidFile).text()).trim())
    expect(pid).toBeGreaterThan(0)
    let alive = true
    for (let attempt = 0; attempt < 50 && alive; attempt++) {
      try {
        process.kill(pid, 0)
        await Bun.sleep(100)
      }
      catch {
        alive = false
      }
    }
    expect(alive).toBe(false)
  }, 30_000)

  it('says why a restore failed', async () => {
    const destination = join(dir, '2026-08-13T09-00-00-000.postgres.sql.gz')
    writeFileSync(destination, Bun.gzipSync(new TextEncoder().encode(sql)))

    await expect(readDump(tool(`cat > /dev/null; echo 'psql: error: relation exists' >&2; exit 3`), destination, undefined, { via }))
      .rejects.toThrow('relation exists')
  })

  it('reports the tool, not gzip, when the tool stops reading early', async () => {
    const destination = join(dir, '2026-08-13T09-00-00-000.postgres.sql.gz')
    writeFileSync(destination, Bun.gzipSync(new TextEncoder().encode(sql.repeat(200))))

    await expect(readDump(tool(`head -c 10 > /dev/null; echo 'psql: error: syntax error at line 1' >&2; exit 3`), destination, undefined, { via }))
      .rejects.toThrow('psql: error: syntax error at line 1')
  })

  it('fails a restore from a truncated dump even though the tool exits 0', async () => {
    const destination = join(dir, '2026-08-13T09-00-00-000.postgres.sql.gz')
    const whole = Bun.gzipSync(new TextEncoder().encode(sql.repeat(50)))
    writeFileSync(destination, whole.subarray(0, Math.floor(whole.length / 2)))

    await expect(readDump(tool('cat > /dev/null'), destination, undefined, { via }))
      .rejects.toThrow(/^gzip: /)
  })

  it('restores a dump written as several gzip members, which the in-process path writes', async () => {
    const destination = join(dir, '2026-08-13T09-00-00-000.postgres.sql.gz')
    const half = new TextEncoder().encode(sql)
    writeFileSync(destination, Buffer.concat([Bun.gzipSync(half), Bun.gzipSync(half)]))
    const restored = join(dir, 'restored.sql')

    await readDump(tool(`cat > '${restored}'`), destination, undefined, { via })
    expect(await Bun.file(restored).text()).toBe(sql + sql)
  })
})

describe('a server dump, whichever way the box moves the bytes', () => {
  const sql = 'INSERT INTO t VALUES (1, \'row\');\n'.repeat(2000)

  it('takes and restores a dump with nothing said about plumbing, as the command does', async () => {
    const destination = join(dir, '2026-08-13T09-00-00-000.postgres.sql.gz')
    const source = join(dir, 'source.sql')
    writeFileSync(source, sql)
    const restored = join(dir, 'restored.sql')

    await writeDump(tool(`cat '${source}'`), destination)
    await readDump(tool(`cat > '${restored}'`), destination)
    expect(await Bun.file(restored).text()).toBe(sql)
  })

  it('reports gzip when gzip is what failed', async () => {
    if (process.platform === 'win32')
      return
    const bin = join(dir, 'bin')
    mkdirSync(bin)
    writeFileSync(join(bin, 'gzip'), '#!/bin/sh\ncat > /dev/null\necho \'gzip: stdout: No space left on device\' >&2\nexit 1\n', { mode: 0o755 })
    const destination = join(dir, '2026-08-13T09-00-00-000.postgres.sql.gz')
    const command = { ...tool(`printf 'a dump'`), env: { PATH: `${bin}:${process.env.PATH}` } }

    await expect(writeDump(command, destination, undefined, { via: 'pipe' }))
      .rejects.toThrow('gzip: stdout: No space left on device')
    expect(existsSync(destination)).toBe(false)
    expect(existsSync(`${destination}.partial`)).toBe(false)
  })

  it('still restores an uncompressed dump taken before dumps were compressed', async () => {
    const old = join(dir, '2026-08-13T09-00-00-000.postgres.sql')
    writeFileSync(old, sql)
    const restored = join(dir, 'restored.sql')

    await readDump(tool(`cat > '${restored}'`), old)
    expect(await Bun.file(restored).text()).toBe(sql)
  })

  it('says why a restore of an uncompressed dump failed', async () => {
    const old = join(dir, '2026-08-13T09-00-00-000.postgres.sql')
    writeFileSync(old, sql)

    await expect(readDump(tool(`cat > /dev/null; echo 'psql: error: relation exists' >&2; exit 3`), old))
      .rejects.toThrow('relation exists')
  })
})

describe('resolveBackupTimeout', () => {
  it('is an hour when nothing says otherwise', () => {
    expect(resolveBackupTimeout({}, {})).toBe(DEFAULT_DUMP_TIMEOUT_SECONDS * 1000)
    expect(DEFAULT_DUMP_TIMEOUT_SECONDS).toBe(3600)
  })

  it('takes the flag over the environment over the config, each in seconds', () => {
    const config = { backups: { timeout: 60 } }
    expect(resolveBackupTimeout(config, {})).toBe(60_000)
    expect(resolveBackupTimeout(config, { DB_BACKUP_TIMEOUT: '120' })).toBe(120_000)
    expect(resolveBackupTimeout(config, { DB_BACKUP_TIMEOUT: '120' }, '7200')).toBe(7_200_000)
    expect(resolveBackupTimeout(config, { DB_BACKUP_TIMEOUT: '' })).toBe(60_000)
  })

  it('refuses a deadline it cannot read, and refuses to have none', () => {
    expect(() => resolveBackupTimeout({}, { DB_BACKUP_TIMEOUT: 'soon' })).toThrow('DB_BACKUP_TIMEOUT must be a number of seconds')
    expect(() => resolveBackupTimeout({}, {}, '0')).toThrow('--timeout must be a number of seconds')
    expect(() => resolveBackupTimeout({ backups: { timeout: -5 } }, {})).toThrow('backups.timeout must be a number of seconds')
  })
})

describe('a SQLite backup, taken and put back', () => {
  it('restores the rows that were there when it was taken', async () => {
    const live = join(dir, 'app.sqlite')
    const dump = join(dir, 'dump.sqlite')

    const database = new Database(live)
    database.exec('CREATE TABLE customers (id INTEGER PRIMARY KEY, email TEXT)')
    database.exec(`INSERT INTO customers (email) VALUES ('a@example.com'), ('b@example.com')`)
    database.close()

    await dumpSqlite(live, dump)
    expect(existsSync(dump)).toBe(true)

    // The migration from hell: the table is gone.
    const wrecked = new Database(live)
    wrecked.exec('DROP TABLE customers')
    wrecked.close()

    const displaced = await restoreSqlite(dump, live, 1)
    expect(displaced).toBe(`${live}.replaced-1`)

    const restored = new Database(live, { readonly: true })
    const rows = restored.query('SELECT email FROM customers ORDER BY email').all() as { email: string }[]
    restored.close()

    expect(rows.map(r => r.email)).toEqual(['a@example.com', 'b@example.com'])
  })

  it('keeps the database it replaced, because restoring the wrong dump happens', async () => {
    const live = join(dir, 'app.sqlite')
    const dump = join(dir, 'dump.sqlite')

    const database = new Database(live)
    database.exec('CREATE TABLE t (id INTEGER PRIMARY KEY)')
    database.close()
    await dumpSqlite(live, dump)

    const displaced = await restoreSqlite(dump, live, 99)

    expect(displaced).toBe(`${live}.replaced-99`)
    expect(existsSync(displaced!)).toBe(true)
  })

  it('restores onto a box that has no database yet', async () => {
    const live = join(dir, 'fresh.sqlite')
    const source = join(dir, 'seed.sqlite')

    const database = new Database(source)
    database.exec('CREATE TABLE t (id INTEGER PRIMARY KEY)')
    database.close()

    expect(await restoreSqlite(source, live, 1)).toBeNull()
    expect(existsSync(live)).toBe(true)
  })

  it('will not quietly overwrite an existing dump', async () => {
    const live = join(dir, 'app.sqlite')
    const dump = join(dir, 'dump.sqlite')

    const database = new Database(live)
    database.exec('CREATE TABLE t (id INTEGER PRIMARY KEY)')
    database.close()

    await dumpSqlite(live, dump)

    // Two dumps in the same second must not silently become one.
    await expect(dumpSqlite(live, dump)).rejects.toThrow()
  })
})

describe('naming and retention', () => {
  const target = { engine: 'sqlite' as const, database: 'app.sqlite' }

  it('names dumps so that sorting them by name sorts them by time', () => {
    const older = backupFileName(target, new Date('2026-08-13T09:00:00.000Z'))
    const newer = backupFileName(target, new Date('2026-08-13T10:00:00.000Z'))

    expect([newer, older].sort()).toEqual([older, newer])
  })

  it('recognises its own file names and nothing else', () => {
    expect(isBackupFileName(backupFileName(target, new Date('2026-08-13T09:00:00.000Z')))).toBe(true)
    expect(isBackupFileName('notes.txt')).toBe(false)
    expect(isBackupFileName('app.sqlite')).toBe(false)
    // The file a restore moved aside is not itself a backup to be pruned.
    expect(isBackupFileName('app.sqlite.replaced-1')).toBe(false)
  })

  it('prunes the oldest and keeps exactly the retained count', () => {
    const names = ['1', '2', '3', '4', '5'].map((_, i) =>
      backupFileName(target, new Date(Date.UTC(2026, 7, 13, 9 + i))))

    expect(prunableBackups(names, 2)).toEqual([names[0], names[1], names[2]])
    expect(prunableBackups(names, 5)).toEqual([])
    expect(prunableBackups(names, 99)).toEqual([])
  })

  it('never prunes when retention is nonsense, rather than deleting everything', () => {
    // `--retain notanumber` parses to NaN. Treating that as "keep 0" would make
    // a typo delete every backup the app has.
    const names = [backupFileName(target, new Date('2026-08-13T09:00:00.000Z'))]

    expect(prunableBackups(names, Number.NaN)).toEqual([])
    expect(prunableBackups(names, 0)).toEqual([])
    expect(prunableBackups(names, -1)).toEqual([])
  })

  it('names a server dump as compressed SQL and a SQLite dump as a database', () => {
    const at = new Date('2026-08-13T09:00:00.000Z')
    expect(backupFileName({ engine: 'postgres', database: 'app' }, at)).toBe('2026-08-13T09-00-00-000.postgres.sql.gz')
    expect(backupFileName({ engine: 'mysql', database: 'app' }, at)).toBe('2026-08-13T09-00-00-000.mysql.sql.gz')
    expect(backupFileName(target, at)).toBe('2026-08-13T09-00-00-000.sqlite.sqlite')
    expect(isCompressedBackup('2026-08-13T09-00-00-000.postgres.sql.gz')).toBe(true)
    expect(isCompressedBackup('2026-08-13T09-00-00-000.postgres.sql')).toBe(false)
  })

  it('counts dumps taken before compression toward retention, oldest first', () => {
    const old = '2026-08-13T09-00-00-000.postgres.sql'
    const newer = '2026-08-13T10-00-00-000.postgres.sql.gz'

    expect(isBackupFileName(old)).toBe(true)
    expect(isBackupFileName(newer)).toBe(true)
    // A half-written dump is not a backup, so it neither counts nor gets restored.
    expect(isBackupFileName(`${newer}.partial`)).toBe(false)
    expect(prunableBackups([newer, old], 1)).toEqual([old])
  })

  it('ignores files it did not write when deciding what to delete', () => {
    const mine = backupFileName(target, new Date('2026-08-13T09:00:00.000Z'))

    expect(prunableBackups(['README', 'app.sqlite', mine], 1)).toEqual([])
  })
})

describe('what the operator is told when a dump fails', () => {
  it('leads with the error line, not the last line', () => {
    // Measured against a live Postgres: taking the last line alone reported
    // only the version numbers and dropped "server version mismatch".
    const stderr = [
      'pg_dump: error: aborting because of server version mismatch',
      'pg_dump: detail: server version: 17.10; pg_dump version: 16.14 (Homebrew)',
    ].join('\n')

    const detail = toolFailureDetail(stderr, 'pg_dump')

    expect(detail).toContain('aborting because of server version mismatch')
    expect(detail).toContain('17.10')
    // The caller adds its own `pg_dump: ` prefix.
    expect(detail.startsWith('pg_dump:')).toBe(false)
  })

  it('falls back to the last line when nothing says "error"', () => {
    expect(toolFailureDetail('connection refused', 'psql')).toBe('connection refused')
  })

  it('says nothing rather than something misleading when stderr is empty', () => {
    expect(toolFailureDetail('   \n\n', 'pg_dump')).toBe('')
  })

  it('never lets the password reach a log line', () => {
    expect(withoutPassword('psql: FATAL: password "hunter2" failed', 'hunter2'))
      .toBe('psql: FATAL: password "***" failed')
    expect(withoutPassword('no password here', '')).toBe('no password here')
    expect(withoutPassword('no password here', undefined)).toBe('no password here')
  })
})

describe('the directory a dump lands in', () => {
  it('lists only dumps, so a stray file cannot be restored by accident', () => {
    const target = { engine: 'sqlite' as const, database: 'app.sqlite' }
    const name = backupFileName(target, new Date('2026-08-13T09:00:00.000Z'))

    mkdirSync(join(dir, 'backups'))
    writeFileSync(join(dir, 'backups', name), '')
    writeFileSync(join(dir, 'backups', 'notes.txt'), '')

    const listed = ['notes.txt', name].filter(isBackupFileName)
    expect(listed).toEqual([name])
  })
})

/**
 * Backup destinations (stacksjs/stacks#2313).
 *
 * A dump on the same disk as the database survives a bad migration and not the
 * loss of the box. These pin the parsing of where it goes instead — including
 * the refusal that matters most: a local path, which would let an app believe
 * it had configured a backup while staying one disk failure from nothing.
 */
describe('parseBackupDestination', () => {
  it('parses an s3 destination with a prefix', () => {
    expect(parseBackupDestination('s3://my-bucket/db/daily')).toEqual({
      kind: 's3',
      target: 'my-bucket',
      prefix: 'db/daily',
    })
  })

  it('parses a disk destination, which is what the scaffolded bucket is', () => {
    expect(parseBackupDestination('disk://backups')).toEqual({ kind: 'disk', target: 'backups', prefix: '' })
  })

  it('trims surrounding and trailing slashes from the prefix', () => {
    expect(parseBackupDestination('s3://b/daily/').prefix).toBe('daily')
    expect(parseBackupDestination('  disk://backups/nightly  ').prefix).toBe('nightly')
  })

  it('refuses a local path, which is the belief this exists to correct', () => {
    expect(() => parseBackupDestination('/mnt/backups')).toThrow(/not accepted/)
    expect(() => parseBackupDestination('file:///mnt/backups')).toThrow()
    expect(() => parseBackupDestination('./backups')).toThrow()
  })

  it('refuses a scheme it cannot upload to, rather than guessing', () => {
    expect(() => parseBackupDestination('gs://bucket/prefix')).toThrow()
    expect(() => parseBackupDestination('')).toThrow()
  })
})

describe('backupObjectKey', () => {
  it('joins the prefix to the file name', () => {
    const destination = parseBackupDestination('s3://b/db/daily')

    expect(backupObjectKey(destination, '2026-09-01.sql')).toBe('db/daily/2026-09-01.sql')
  })

  it('uses the bare file name when there is no prefix', () => {
    expect(backupObjectKey(parseBackupDestination('disk://backups'), 'x.sql')).toBe('x.sql')
  })
})

describe('resolveBackupRetain', () => {
  it('keeps seven when nothing says otherwise', () => {
    expect(resolveBackupRetain({}, {})).toBe(DEFAULT_RETAIN)
    expect(DEFAULT_RETAIN).toBe(7)
    // What `env.DB_BACKUP_RETAIN || ''` would produce in a config file.
    expect(resolveBackupRetain({ backups: { retain: '' } }, { DB_BACKUP_RETAIN: '' })).toBe(DEFAULT_RETAIN)
  })

  it('reads config/database.ts, which is what the deploy\'s flagless backup has to go on', () => {
    expect(resolveBackupRetain({ backups: { retain: 2 } }, {})).toBe(2)
  })

  it('lets the env beat config and the flag beat both', () => {
    expect(resolveBackupRetain({ backups: { retain: 2 } }, { DB_BACKUP_RETAIN: '3' })).toBe(3)
    expect(resolveBackupRetain({ backups: { retain: 2 } }, { DB_BACKUP_RETAIN: '3' }, '30')).toBe(30)
  })

  it('throws on a count it cannot use, naming where it came from', () => {
    // Falling back to seven would be the disk filling up again after someone
    // set it lower; keeping none would delete every backup.
    expect(() => resolveBackupRetain({}, { DB_BACKUP_RETAIN: 'three' })).toThrow('DB_BACKUP_RETAIN')
    expect(() => resolveBackupRetain({ backups: { retain: 0 } }, {})).toThrow('backups.retain')
    expect(() => resolveBackupRetain({}, {}, '2.5')).toThrow('--retain')
  })
})

describe('resolveBackupDestination', () => {
  it('is null when nothing is configured, which is the ordinary case', () => {
    expect(resolveBackupDestination({}, {})).toBeNull()
    expect(resolveBackupDestination({ backups: {} }, {})).toBeNull()
    // An empty string is what `env.DB_BACKUP_DESTINATION || ''` produces in the
    // scaffolded config, and must read as "not configured" rather than throw.
    expect(resolveBackupDestination({ backups: { destination: '' } }, {})).toBeNull()
    expect(resolveBackupDestination({ backups: { destination: '   ' } }, {})).toBeNull()
  })

  it('reads config/database.ts', () => {
    expect(resolveBackupDestination({ backups: { destination: 'disk://backups/x' } }, {})).toEqual({
      kind: 'disk',
      target: 'backups',
      prefix: 'x',
    })
  })

  it('lets the env win, so a deploy can set it without editing config', () => {
    const resolved = resolveBackupDestination(
      { backups: { destination: 'disk://backups' } },
      { DB_BACKUP_DESTINATION: 's3://prod-dumps/nightly' },
    )

    expect(resolved).toEqual({ kind: 's3', target: 'prod-dumps', prefix: 'nightly' })
  })

  it('throws on a configured value it cannot understand', () => {
    // Silently ignoring it would leave the dump on one disk while the app
    // believes otherwise, which is the failure mode, not a lenient default.
    expect(() => resolveBackupDestination({ backups: { destination: '/mnt/x' } }, {})).toThrow()
  })
})
