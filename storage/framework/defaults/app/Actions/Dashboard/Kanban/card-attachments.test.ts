import { afterAll, afterEach, beforeEach, describe, expect, it, spyOn } from 'bun:test'
import { Database } from 'bun:sqlite'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createLocalStorage } from '@stacksjs/storage'
import { CARD_ATTACHMENT_URL_TTL_SECONDS, removeCardAttachments, shapeCardAttachment, signCardAttachmentUrl } from './card-attachments'

const row = {
  id: 7,
  uuid: 'c0ffee00-0000-4000-8000-000000000000',
  disk: 'local',
  path: 'feedback/42/0190f3b4-7c21-4f0a-9a1e-3d5c7b8e9f00.png',
  mime_type: 'image/png',
  size_bytes: 120_000,
  created_at: '2026-10-08 09:12:00',
}

describe('shapeCardAttachment', () => {
  it('returns what the dialog renders and nothing else', () => {
    expect(shapeCardAttachment(row, 'https://example.com/__storage/x?token=y')).toEqual({
      id: 7,
      uuid: 'c0ffee00-0000-4000-8000-000000000000',
      mimeType: 'image/png',
      sizeBytes: 120_000,
      createdAt: '2026-10-08 09:12:00',
      url: 'https://example.com/__storage/x?token=y',
    })
  })

  it('never publishes the storage path or the disk', () => {
    // The signed URL already carries the path it grants, so the bare path
    // adds nothing a client can use and does invite trying it without a
    // token.
    const shaped = shapeCardAttachment(row, null) as Record<string, unknown>
    expect(Object.keys(shaped).sort()).toEqual(['createdAt', 'id', 'mimeType', 'sizeBytes', 'url', 'uuid'])
    expect(JSON.stringify(shaped)).not.toContain('feedback/42')
    expect(JSON.stringify(shaped)).not.toContain('local')
  })

  it('lists an attachment whose URL could not be minted', () => {
    // Null, not omitted and not thrown: "there is a screenshot nobody can
    // open" is worth chasing and is a different problem from "there is no
    // screenshot".
    expect(shapeCardAttachment(row, null).url).toBeNull()
  })

  it('reads a row whose numbers arrive as strings', () => {
    // SQLite and Postgres disagree about this often enough that the Kanban
    // actions already normalise everywhere else.
    const shaped = shapeCardAttachment({ ...row, id: '7' as never, size_bytes: '120000' as never }, null)
    expect(shaped.id).toBe(7)
    expect(shaped.sizeBytes).toBe(120_000)
  })
})

describe('the signed URL lifetime', () => {
  it('outlasts opening a card and not much more', () => {
    // Long enough to look at a screenshot, short enough that a URL copied
    // out of devtools is not a handout.
    expect(CARD_ATTACHMENT_URL_TTL_SECONDS).toBeGreaterThanOrEqual(5 * 60)
    expect(CARD_ATTACHMENT_URL_TTL_SECONDS).toBeLessThanOrEqual(60 * 60)
  })
})

describe('signing one attachment', () => {
  const warn = spyOn(console, 'warn').mockImplementation(() => {})
  afterEach(() => warn.mockClear())
  afterAll(() => warn.mockRestore())

  it('asks the row\'s own disk, for the row\'s path, with the card lifetime', async () => {
    const asked: unknown[] = []
    const url = await signCardAttachmentUrl(row, (name) => {
      asked.push(name)
      return {
        signedUrl: async (path, options) => {
          asked.push(path, options)
          return `https://app.test/__storage/${path}?token=t`
        },
      }
    })
    expect(url).toBe(`https://app.test/__storage/${row.path}?token=t`)
    expect(asked).toEqual(['local', row.path, { expiresIn: CARD_ATTACHMENT_URL_TTL_SECONDS }])
  })

  it('is null, not a throw, for a disk with no signer', async () => {
    expect(await signCardAttachmentUrl(row, () => ({}))).toBeNull()
    expect(String(warn.mock.calls[0]?.[0])).toContain('does not support signedUrl')
  })

  it('is null, not a throw, for a disk that is no longer configured', async () => {
    const url = await signCardAttachmentUrl(row, () => {
      throw new Error('disk \'local\' is not configured')
    })
    expect(url).toBeNull()
    expect(String(warn.mock.calls[0]?.[0])).toContain(`attachment ${row.id}`)
  })

  it('is null, not a throw, when the signer refuses', async () => {
    const url = await signCardAttachmentUrl(row, () => ({
      signedUrl: async () => { throw new Error('APP_KEY is too short to sign with') },
    }))
    expect(url).toBeNull()
  })
})

/**
 * stacksjs/stacks#2881. Deleting a card, column or board removed the card rows
 * and left every screenshot on the disk, with an orphaned row pointing at it.
 * Asserting the row is gone is what made that look done, so these assert the
 * bytes: a real SQLite table and a real local disk.
 */
describe('removing a card\'s attachments', () => {
  let dir = ''
  let sqlite: Database
  const disk = () => createLocalStorage({ root: join(dir, 'disk') })
  const runner = {
    unsafe: (sql: string, params: unknown[] = []) => ({
      execute: async () => sqlite.query(sql).all(...(params as never[])),
    }),
  }

  function attach(id: number, cardId: number, path: string): void {
    mkdirSync(join(dir, 'disk', path, '..'), { recursive: true })
    writeFileSync(join(dir, 'disk', path), 'a picture of somebody\'s screen')
    sqlite.query('INSERT INTO card_attachments (id, card_id, disk, path) VALUES (?, ?, ?, ?)').run(id, cardId, 'local', path)
  }
  const onDisk = (path: string) => existsSync(join(dir, 'disk', path))
  const rowsFor = (cardId: number) => sqlite.query('SELECT id FROM card_attachments WHERE card_id = ?').all(cardId).length

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'card-attachments-'))
    sqlite = new Database(':memory:')
    sqlite.run('CREATE TABLE card_attachments (id INTEGER PRIMARY KEY, card_id INTEGER, disk TEXT, path TEXT)')
  })
  afterEach(() => {
    sqlite.close()
    rmSync(dir, { recursive: true, force: true })
  })

  it('deletes the bytes and the rows of the cards it is given, and no others', async () => {
    attach(1, 42, 'feedback/42/a.png')
    attach(2, 42, 'feedback/42/b.png')
    attach(3, 7, 'feedback/7/c.png')

    const removed = await removeCardAttachments(runner, { sql: 'card_id = ?', params: [42] }, () => disk())

    expect(removed).toBe(2)
    expect(onDisk('feedback/42/a.png')).toBe(false)
    expect(onDisk('feedback/42/b.png')).toBe(false)
    expect(rowsFor(42)).toBe(0)
    expect(onDisk('feedback/7/c.png')).toBe(true)
    expect(rowsFor(7)).toBe(1)
  })

  it('opens the disk each row names', async () => {
    attach(1, 42, 'feedback/42/a.png')
    const asked: string[] = []
    await removeCardAttachments(runner, { sql: 'card_id = ?', params: [42] }, (name) => {
      asked.push(name)
      return disk()
    })
    expect(asked).toEqual(['local'])
  })

  it('treats a file that is already gone as deleted, so a second run finishes', async () => {
    attach(1, 42, 'feedback/42/a.png')
    rmSync(join(dir, 'disk', 'feedback/42/a.png'))

    expect(await removeCardAttachments(runner, { sql: 'card_id = ?', params: [42] }, () => disk())).toBe(1)
    expect(rowsFor(42)).toBe(0)
  })

  it('touches no row when a disk refuses, so the rows still say where the files are', async () => {
    attach(1, 42, 'feedback/42/a.png')
    attach(2, 42, 'feedback/42/b.png')

    const run = removeCardAttachments(runner, { sql: 'card_id = ?', params: [42] }, () => ({
      deleteFile: async () => { throw new Error('S3 is unreachable') },
    }))

    await expect(run).rejects.toThrow('could not delete attachment 1 (local:feedback/42/a.png), so nothing was deleted: S3 is unreachable')
    expect(rowsFor(42)).toBe(2)
  })

  it('is a no-op for a card with no attachments', async () => {
    let opened = false
    const removed = await removeCardAttachments(runner, { sql: 'card_id = ?', params: [42] }, () => {
      opened = true
      return disk()
    })
    expect(removed).toBe(0)
    expect(opened).toBe(false)
  })
})

describe('the destroy actions', () => {
  const source = (file: string) => readFileSync(join(import.meta.dir, file), 'utf8')

  for (const [file, scope] of [['CardDestroyAction.ts', 'card_id = '], ['ColumnDestroyAction.ts', 'WHERE column_id = '], ['BoardDestroyAction.ts', 'WHERE board_id = ']] as const) {
    it(`${file} removes attachments, files included, before any card row`, () => {
      const text = source(file)
      const removal = text.indexOf('await removeCardAttachments(qb,')
      expect(removal).toBeGreaterThan(-1)
      expect(text.slice(removal, removal + 200)).toContain(scope)
      // Inside the transaction, ahead of every delete, so a refusing disk
      // rolls the whole thing back.
      expect(removal).toBeGreaterThan(text.indexOf('await db.transaction('))
      expect(removal).toBeLessThan(text.indexOf('DELETE FROM') === -1 ? text.indexOf('deleteFrom(') : Math.min(text.indexOf('DELETE FROM'), text.indexOf('deleteFrom(')))
    })
  }

  it('BoardDestroyAction removes the board\'s feedback links', () => {
    expect(source('BoardDestroyAction.ts')).toContain(`deleteFrom('feedback_tokens').where('board_id', '=', id)`)
  })
})

describe('the card dialog', () => {
  const dialog = readFileSync(
    join(import.meta.dir, '../../../../resources/components/Dashboard/Kanban/KanbanCardDialog.stx'),
    'utf8',
  )

  it('renders the attachments it is given', () => {
    expect(dialog).toContain('openCard()?.attachments')
    expect(dialog).toContain(':for="attachment in cardAttachments"')
  })

  it('opens a signed URL in a new tab, with the referrer withheld', () => {
    // The URL is a bearer credential for one file. `noreferrer` keeps it out
    // of the next page's `Referer` header.
    expect(dialog).toContain('rel="noopener noreferrer"')
    expect(dialog).toContain('target="_blank"')
  })

  it('shows a placeholder rather than a broken image when there is no URL', () => {
    expect(dialog).toMatch(/:if="attachment\.url"[\s\S]*?:else/)
  })
})
