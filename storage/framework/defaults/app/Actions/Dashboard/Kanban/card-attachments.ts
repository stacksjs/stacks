import type { StorageAdapter } from '@stacksjs/storage'
import { db, getDatabaseDialect, sqlHelpers } from '@stacksjs/database/runtime'

/**
 * Reading a card's attachments back out.
 *
 * The bytes sit on a private disk, because the only thing that writes them
 * today is the unauthenticated feedback intake and a stranger's upload does
 * not belong in a web-served directory (stacksjs/stacks#2872). So the
 * dashboard cannot link to a file path; it links to a short-lived signed URL,
 * minted per request against `/__storage/{path}`, which verifies the HMAC
 * against both the path and the expiry.
 */

export interface CardAttachmentRow {
  id: number
  uuid: string | null
  disk: string
  path: string
  mime_type: string
  size_bytes: number
  created_at: string | null
}

export interface CardAttachmentView {
  id: number
  uuid: string | null
  mimeType: string
  sizeBytes: number
  createdAt: string | null
  /**
   * A signed, expiring URL, or null when one could not be minted.
   *
   * Null rather than absent, and rather than throwing: a file whose URL
   * cannot be signed is one the dashboard should still list, because "the
   * card has a screenshot nobody can open" is a different problem from "the
   * card has no screenshot" and only the first one is worth chasing.
   */
  url: string | null
}

/** How long a minted URL lasts. Long enough to open a card, short enough that a copied link is not a handout. */
export const CARD_ATTACHMENT_URL_TTL_SECONDS = 15 * 60

/**
 * The response shape, with the storage path deliberately left out.
 *
 * The signed URL carries the path it grants, so publishing the bare path
 * alongside adds nothing a client can use and does invite someone to try it
 * without a token.
 */
export function shapeCardAttachment(row: CardAttachmentRow, url: string | null): CardAttachmentView {
  return {
    id: Number(row.id),
    uuid: row.uuid ?? null,
    mimeType: String(row.mime_type ?? ''),
    sizeBytes: Number(row.size_bytes ?? 0),
    createdAt: row.created_at ?? null,
    url,
  }
}

/** One card's attachments, oldest first, each with a freshly signed URL. */
export async function cardAttachments(cardId: number): Promise<CardAttachmentView[]> {
  const { param } = sqlHelpers(getDatabaseDialect())
  const rows = await db.unsafe(
    `SELECT id, uuid, disk, path, mime_type, size_bytes, created_at
     FROM card_attachments
     WHERE card_id = ${param(1)}
     ORDER BY created_at ASC, id ASC`,
    [cardId],
  ).execute() as unknown as CardAttachmentRow[]

  if (!rows?.length)
    return []

  const { Storage } = await import('@stacksjs/storage')

  return Promise.all((rows ?? []).map(async row =>
    shapeCardAttachment(row, await signCardAttachmentUrl(row, name => Storage.disk(name as never))),
  ))
}

/**
 * A signed URL for one attachment, or null when its disk cannot mint one.
 *
 * Per attachment, so one unreadable file does not take the card down with it.
 */
export async function signCardAttachmentUrl(
  row: CardAttachmentRow,
  openDisk: (name: string) => Pick<StorageAdapter, 'signedUrl'>,
): Promise<string | null> {
  try {
    const disk = openDisk(row.disk)
    // A disk with no signer at all (a driver that cannot mint one) is the
    // same outcome as one that fails to: listed, but with nothing to open.
    if (typeof disk.signedUrl !== 'function')
      throw new Error(`disk '${row.disk}' does not support signedUrl`)
    return await disk.signedUrl(row.path, { expiresIn: CARD_ATTACHMENT_URL_TTL_SECONDS })
  }
  catch (err) {
    // A disk that is no longer configured or cannot sign, or an APP_KEY too
    // short to sign with.
    console.warn(`[card-attachments] could not sign attachment ${row.id}: ${err instanceof Error ? err.message : String(err)}`)
    return null
  }
}

/** What `removeCardAttachments` runs its two statements through: `db`, or a transaction. */
export interface AttachmentStatementRunner {
  unsafe: (sql: string, params?: unknown[]) => { execute: () => Promise<unknown> }
}

/**
 * Remove every attachment of the cards `cardsWhere` selects: the bytes, then the rows.
 *
 * Deleting a card, a column or a board used to leave both behind. The cascade
 * those actions run lives in the application, not in a foreign key (SQLite
 * does not enforce one unless asked), and none of them knew about
 * `card_attachments`. So every screenshot on a deleted card stayed on the disk
 * with a row pointing at it that nothing could reach (stacksjs/stacks#2881).
 * A feedback screenshot is a picture of a stranger's screen, which is exactly
 * what a deletion is supposed to remove.
 *
 * Bytes first, then rows, so it can be run again. A file already gone counts
 * as deleted (that is `deleteFile`'s contract on every disk), and any other
 * failure throws before a row is touched. Run inside the caller's transaction,
 * that means a disk it cannot reach leaves the card exactly as it was, with
 * every row still saying where its file is, rather than a card that is gone
 * and a file nothing can find any more.
 *
 * `cardsWhere` is a predicate over `card_id`, for example
 * `card_id IN (SELECT id FROM cards WHERE board_id = $1)`, with its params.
 * Returns how many attachments went.
 */
export async function removeCardAttachments(
  handle: AttachmentStatementRunner,
  cardsWhere: { sql: string, params: unknown[] },
  openDisk: (name: string) => Pick<StorageAdapter, 'deleteFile'>,
): Promise<number> {
  const rows = await handle.unsafe(
    `SELECT id, disk, path FROM card_attachments WHERE ${cardsWhere.sql}`,
    cardsWhere.params,
  ).execute() as Array<Pick<CardAttachmentRow, 'id' | 'disk' | 'path'>>

  if (!rows?.length)
    return 0

  for (const row of rows) {
    try {
      await openDisk(row.disk).deleteFile(row.path)
    }
    catch (err) {
      throw new Error(`could not delete attachment ${row.id} (${row.disk}:${row.path}), so nothing was deleted: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  await handle.unsafe(`DELETE FROM card_attachments WHERE ${cardsWhere.sql}`, cardsWhere.params).execute()
  return rows.length
}

/** The real disks, for `removeCardAttachments`. */
export async function storageDisks(): Promise<(name: string) => Pick<StorageAdapter, 'deleteFile'>> {
  const { Storage } = await import('@stacksjs/storage')
  return name => Storage.disk(name as never)
}
