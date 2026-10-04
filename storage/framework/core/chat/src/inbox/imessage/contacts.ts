import { Database } from 'bun:sqlite'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { normalizeHandle } from './handles'

/**
 * Names for handles, read from the Contacts database the way Messages shows
 * them. chat.db only knows `+15551234567`; a list of phone numbers is not a
 * conversation list anyone recognizes.
 *
 * Contacts keeps one SQLite store per account (iCloud, Google, On My Mac)
 * under `AddressBook/Sources/<uuid>/`, plus a legacy one at the top level.
 * They sit behind the same privacy wall as chat.db, so the Full Disk Access
 * Attic already needs covers them. Every failure here is soft: no names just
 * means handles are shown as numbers.
 */

export const DEFAULT_ADDRESS_BOOK_DIR = join(homedir(), 'Library', 'Application Support', 'AddressBook')

export interface ContactCard {
  name: string
  /** Initials for the avatar, e.g. "JA". */
  initials: string
  /** Where the contact's photo is, when it has one: read it with {@link Contacts.photo}. */
  photo?: { file: string, record: number } | null
}

/**
 * A contact photo column's bytes as the image they stand for. Contacts writes
 * a one-byte tag first: 1 means the JPEG follows inline, 2 means the rest is
 * the UUID of a file in the store's `.AddressBook-v22_SUPPORT/_EXTERNAL_DATA`
 * (iCloud's larger photos), NUL-terminated.
 */
export function contactImage(store: string, data: Uint8Array | null): Uint8Array | null {
  if (!data || data.length < 2)
    return null
  if (data[0] === 1)
    return data.subarray(1)
  if (data[0] === 2) {
    const uuid = new TextDecoder().decode(data.subarray(1)).replace(/\0+$/, '').trim()
    if (!/^[\w-]+$/.test(uuid))
      return null
    const file = join(dirname(store), '.AddressBook-v22_SUPPORT', '_EXTERNAL_DATA', uuid)
    try {
      return new Uint8Array(readFileSync(file))
    }
    catch {
      return null
    }
  }
  return null
}

function addressBookFiles(root: string): string[] {
  const files: string[] = []
  const top = join(root, 'AddressBook-v22.abcddb')
  if (existsSync(top))
    files.push(top)
  const sources = join(root, 'Sources')
  try {
    for (const entry of readdirSync(sources)) {
      const file = join(sources, entry, 'AddressBook-v22.abcddb')
      if (existsSync(file))
        files.push(file)
    }
  }
  catch {}
  return files
}

export function initialsOf(name: string): string {
  const words = name.replace(/[^\p{L}\p{N}\s]/gu, ' ').trim().split(/\s+/).filter(Boolean)
  if (words.length === 0)
    return '?'
  const first = words[0]![0]!
  const last = words.length > 1 ? words[words.length - 1]![0]! : ''
  return (first + last).toUpperCase()
}

export class Contacts {
  private byHandle = new Map<string, ContactCard>()

  /** Loads every readable address book; never throws. */
  static load(root: string = DEFAULT_ADDRESS_BOOK_DIR): Contacts {
    const contacts = new Contacts()
    for (const file of addressBookFiles(root)) {
      try {
        contacts.read(file)
      }
      catch {
        // Unreadable (no access, or a store mid-migration): skip it.
      }
    }
    return contacts
  }

  get size(): number {
    return this.byHandle.size
  }

  private read(file: string): void {
    const db = new Database(file, { readonly: true })
    try {
      // Older and hand-made stores have no photo columns; read them when present.
      const columns = new Set((db.query('PRAGMA table_info(ZABCDRECORD)').all() as Array<{ name: string }>).map(c => c.name))
      const photoColumns = ['ZTHUMBNAILIMAGEDATA', 'ZIMAGEDATA'].filter(c => columns.has(c))
      const hasPhoto = photoColumns.length > 0 ? `(${photoColumns.map(c => `${c} IS NOT NULL`).join(' OR ')})` : '0'
      const people = db.query(`
        SELECT Z_PK AS id, ZFIRSTNAME AS first, ZLASTNAME AS last, ZNICKNAME AS nick, ZORGANIZATION AS org, ${hasPhoto} AS hasPhoto
        FROM ZABCDRECORD
      `).all() as Array<{ id: number, first: string | null, last: string | null, nick: string | null, org: string | null, hasPhoto: number }>
      const names = new Map<number, string>()
      const photos = new Set<number>()
      for (const person of people) {
        const full = [person.first, person.last].filter(Boolean).join(' ').trim()
        const name = full || person.nick?.trim() || person.org?.trim()
        if (name)
          names.set(person.id, name)
        if (person.hasPhoto)
          photos.add(person.id)
      }

      const phones = db.query('SELECT ZOWNER AS owner, ZFULLNUMBER AS value FROM ZABCDPHONENUMBER').all() as Array<{ owner: number, value: string | null }>
      const emails = db.query('SELECT ZOWNER AS owner, ZADDRESS AS value FROM ZABCDEMAILADDRESS').all() as Array<{ owner: number, value: string | null }>
      for (const row of [...phones, ...emails]) {
        const name = names.get(row.owner)
        if (!name || !row.value)
          continue
        const handle = normalizeHandle(row.value)
        const photo = photos.has(row.owner) ? { file, record: row.owner } : null
        const known = this.byHandle.get(handle)
        if (!known)
          this.byHandle.set(handle, { name, initials: initialsOf(name), photo })
        // The same person in two accounts: keep the first name, take a photo from either.
        else if (!known.photo && photo)
          known.photo = photo
      }
    }
    finally {
      db.close()
    }
  }

  /** Test seam and manual override. */
  set(handle: string, name: string): void {
    this.byHandle.set(normalizeHandle(handle), { name, initials: initialsOf(name) })
  }

  lookup(handle: string): ContactCard | null {
    return this.byHandle.get(normalizeHandle(handle)) ?? null
  }

  nameFor(handle: string): string | null {
    return this.lookup(handle)?.name ?? null
  }

  hasPhoto(handle: string): boolean {
    return !!this.lookup(handle)?.photo
  }

  /** The contact's photo, the thumbnail when there is one; null when it has none or it cannot be read. */
  photo(handle: string): Uint8Array | null {
    const ref = this.lookup(handle)?.photo
    if (!ref)
      return null
    try {
      const db = new Database(ref.file, { readonly: true })
      try {
        const row = db.query('SELECT ZTHUMBNAILIMAGEDATA AS thumb, ZIMAGEDATA AS full FROM ZABCDRECORD WHERE Z_PK = ?').get(ref.record) as { thumb: Uint8Array | null, full: Uint8Array | null } | null
        return contactImage(ref.file, row?.thumb ?? null) ?? contactImage(ref.file, row?.full ?? null)
      }
      finally {
        db.close()
      }
    }
    catch {
      return null
    }
  }
}
