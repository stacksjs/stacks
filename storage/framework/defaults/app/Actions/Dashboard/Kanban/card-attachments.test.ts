import { afterAll, afterEach, describe, expect, it, spyOn } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { CARD_ATTACHMENT_URL_TTL_SECONDS, shapeCardAttachment, signCardAttachmentUrl } from './card-attachments'

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
