import { chmodSync, copyFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { command, withScratch } from './io'
import { databaseName, postgresCommand } from './inventory'

export async function postgresRecovery(dump: string, workspace: string): Promise<void> {
  await withScratch(join(workspace, 'pg-drill-'), async (scratch) => {
    const restored = join(scratch, 'database.dump')
    copyFileSync(dump, restored)
    chmodSync(restored, 0o600)
    await command(['chown', 'postgres', scratch, restored])
    const data = join(scratch, 'data')
    const pgCtl = [...postgresCommand, '/usr/local/bin/pg_ctl', '-D', data]
    await command([...postgresCommand, '/usr/local/bin/initdb', '-D', data, '-U', 'backupcheck', '--auth=trust', '--no-locale'])
    await command([...pgCtl, '-l', join(scratch, 'postgres.log'), '-o', `-F -c listen_addresses='' -c unix_socket_directories='${scratch}' -p 55432`, '-w', 'start'])
    try {
      const connection = ['--host', scratch, '--port', '55432', '--username', 'backupcheck', '--dbname', 'postgres']
      await command([...postgresCommand, '/usr/local/bin/pg_restore', '--no-owner', '--no-privileges', '--exit-on-error', ...connection, restored], { timeoutMs: 3_600_000 })
      await command([...postgresCommand, '/usr/local/bin/psql', ...connection, '-v', 'ON_ERROR_STOP=1', '-Atc', "SELECT count(*) FROM pg_class WHERE relkind='r'"])
    }
    finally {
      await command([...pgCtl, '-m', 'immediate', '-w', 'stop'])
    }
  })
}

export async function mysqlRecovery(dump: string, name: string, binary: string, workspace: string): Promise<void> {
  const database = databaseName(name)
  const mysql = join(dirname(binary), 'mysql')
  const server = join(dirname(binary), 'mysqld')
  await withScratch(join(workspace, 'mysql-drill-'), async (scratch) => {
    const data = join(scratch, 'data')
    const socket = join(scratch, 'mysql.sock')
    await command([server, '--no-defaults', '--initialize-insecure', '--user=root', `--datadir=${data}`])
    const child = Bun.spawn([server, '--no-defaults', '--user=root', `--datadir=${data}`, `--socket=${socket}`,
      `--pid-file=${join(scratch, 'mysql.pid')}`, '--skip-networking', '--mysqlx=0', '--skip-log-bin',
      '--innodb-flush-log-at-trx-commit=2', '--innodb-buffer-pool-size=256M'], { stdout: 'ignore', stderr: 'ignore' })
    try {
      const deadline = performance.now() + 60_000
      while (!existsSync(socket)) {
        if (child.exitCode !== null || performance.now() > deadline)
          throw new Error('Disposable MySQL did not start')
        await Bun.sleep(100)
      }
      const args = [mysql, '--no-defaults', `--socket=${socket}`, '--user=root', '--binary-mode']
      await command([...args, '--execute', `CREATE DATABASE \`${database}\``])
      // This server has a fresh data directory and listens only on the private
      // scratch socket. Avoid redo writes while loading the full logical dump.
      await command([...args, '--execute', 'ALTER INSTANCE DISABLE INNODB REDO_LOG'])
      await command([...args, database], { input: dump, timeoutMs: 7_200_000 })
      await command([...args, '--execute', 'ALTER INSTANCE ENABLE INNODB REDO_LOG'])
      await command([...args, '--execute', `SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='${database}'`])
    }
    finally {
      if (child.exitCode === null && child.signalCode === null) {
        child.kill('SIGTERM')
        const escalation = setTimeout(() => child.kill('SIGKILL'), 30_000)
        try {
          await child.exited
        }
        finally {
          clearTimeout(escalation)
        }
      }
    }
  })
}
