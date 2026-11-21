import { Database } from 'bun:sqlite'
import { expect, test } from 'bun:test'
import { mkdirSync, readFileSync, readdirSync, symlinkSync, utimesSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import process from 'node:process'
import { command, withScratch } from '../../storage/framework/core/cloud/src/host-backup/io'

test.skipIf(!Bun.which('sqlite3') || !Bun.which('tar'))('mail backup preserves aged archives and archives current mail and SQLite together', async () => {
  await withScratch(join(tmpdir(), 'mail-archive-'), async (root) => {
    const mail = join(root, 'mail-root')
    const backups = join(root, 'persistent-backups')
    mkdirSync(join(mail, 'mail'), { recursive: true })
    mkdirSync(backups, { mode: 0o700 })
    symlinkSync(backups, join(mail, 'backups'))
    writeFileSync(join(mail, 'mail/message'), 'preserved message')
    using db = new Database(join(mail, 'smtp.db'))
    db.run('PRAGMA journal_mode = WAL')
    db.run('CREATE TABLE messages (body TEXT)')
    db.run("INSERT INTO messages VALUES ('preserved row')")
    const previous = join(backups, 'mail-backup-20000101-000000.tgz')
    writeFileSync(previous, 'original archive')
    utimesSync(previous, 1, 1)

    await command([process.execPath, '-e', `import { createMailBackup } from ${JSON.stringify(join(import.meta.dir, 'mail.ts'))}; await createMailBackup()`], {
      env: { PATH: process.env.PATH, MAIL_ROOT: mail, MAIL_ENV_FILE: join(root, 'missing.env'), MAIL_BACKUP_PRESERVE: '1' },
    })
    expect(readFileSync(previous, 'utf8')).toBe('original archive')
    const [archive] = readdirSync(backups).filter(name => name.endsWith('.tgz') && !previous.endsWith(name))
    expect(archive).toBeDefined()
    const file = join(backups, archive!)
    expect(await command(['tar', '-xOzf', file, 'mail/message'])).toBe('preserved message')
    const restored = join(root, 'smtp.db')
    await command(['tar', '-xOzf', file, 'smtp.db'], { output: restored })
    using recovered = new Database(restored, { readonly: true })
    expect(recovered.query('SELECT body FROM messages').get()).toEqual({ body: 'preserved row' })
  })
})
