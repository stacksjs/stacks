import { Database } from 'bun:sqlite'
import { existsSync, readdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
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
      const people = db.query(`
        SELECT Z_PK AS id, ZFIRSTNAME AS first, ZLASTNAME AS last, ZNICKNAME AS nick, ZORGANIZATION AS org
        FROM ZABCDRECORD
      `).all() as Array<{ id: number, first: string | null, last: string | null, nick: string | null, org: string | null }>
      const names = new Map<number, string>()
      for (const person of people) {
        const full = [person.first, person.last].filter(Boolean).join(' ').trim()
        const name = full || person.nick?.trim() || person.org?.trim()
        if (name)
          names.set(person.id, name)
      }

      const phones = db.query('SELECT ZOWNER AS owner, ZFULLNUMBER AS value FROM ZABCDPHONENUMBER').all() as Array<{ owner: number, value: string | null }>
      const emails = db.query('SELECT ZOWNER AS owner, ZADDRESS AS value FROM ZABCDEMAILADDRESS').all() as Array<{ owner: number, value: string | null }>
      for (const row of [...phones, ...emails]) {
        const name = names.get(row.owner)
        if (!name || !row.value)
          continue
        const handle = normalizeHandle(row.value)
        if (!this.byHandle.has(handle))
          this.byHandle.set(handle, { name, initials: initialsOf(name) })
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
}
