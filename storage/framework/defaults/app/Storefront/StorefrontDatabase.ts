/**
 * How the storefront's server-rendered pages read the database.
 *
 * The cart, the three checkout steps and the storefront layout query
 * SQLite directly from their `<script server>` blocks. Each used to open
 * the file itself, and every way that could fail rendered an empty cart
 * without a word in any log:
 *
 *   - stx swallows an error thrown by a server script unless STX_DEBUG
 *     is set, and renders the page from the script's static values, so
 *     a missing column read as "Your cart is empty." No migration
 *     creates `carts.session_token`, which every one of these pages
 *     looks the cart up by.
 *   - The layout caught its own errors and said nothing, on purpose.
 *   - They opened the file read-only, and SQLite (as Bun 1.4.1 ships it)
 *     refuses a read-only connection to a WAL-mode database that has no
 *     `-shm` file beside it. The framework's query builder puts the
 *     database in WAL mode, so a page read worked only while a `-shm`
 *     file happened to exist.
 *   - Under a `DB_CONNECTION` other than sqlite they read whatever SQLite
 *     file `DB_DATABASE_PATH` or `database/stacks.sqlite` named, which
 *     is not the app's database.
 *
 * {@link readStorefront} is the one place those are handled: the page
 * still degrades to its empty cart, and the server log says why.
 */

import { Database } from 'bun:sqlite'
import { resolve } from 'node:path'
import process from 'node:process'

/** Each distinct warning once per process, so a broken schema is not one line per request. */
const warned = new Set<string>()

function warnOnce(message: string): void {
  if (warned.has(message))
    return

  warned.add(message)
  console.warn(message)
}

/**
 * Run `read` against the app's SQLite database and return what it returns,
 * or `fallback` when the database cannot be read, with a warning in the
 * server log naming `page` and the reason.
 *
 * Opened read-write without `create`, with `query_only` on: it can make the
 * `-shm` file a WAL-mode database needs, cannot create a database that is
 * not there, and cannot write to one that is. Closed before returning.
 */
export function readStorefront<T>(page: string, fallback: T, read: (db: Database) => T): T {
  const connection = (process.env.DB_CONNECTION || 'sqlite').toLowerCase()
  if (connection !== 'sqlite') {
    warnOnce(`[storefront] ${page} shows no cart: it reads carts from SQLite, and DB_CONNECTION is ${connection}.`)
    return fallback
  }

  const file = resolve(process.cwd(), process.env.DB_DATABASE_PATH || 'database/stacks.sqlite')
  let db: Database | undefined
  try {
    db = new Database(file, { readwrite: true, create: false })
    db.run('PRAGMA query_only = ON')
    return read(db)
  }
  catch (error) {
    warnOnce(`[storefront] ${page} shows no cart: reading ${file} failed: ${error instanceof Error ? error.message : String(error)}`)
    return fallback
  }
  finally {
    db?.close()
  }
}
