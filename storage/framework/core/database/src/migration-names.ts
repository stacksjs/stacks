/**
 * Choosing a name for a generated migration that no database has recorded.
 *
 * The `migrations` table keys on the FILENAME and stores nothing else about
 * the file: no checksum, no contents. `buddy migrate` runs every file whose
 * name the table does not list, so a new file that happens to carry a name the
 * table already holds is never run, and nothing says so.
 *
 * That happens whenever a corpus is rebuilt. A database migrated before
 * `migrate:regenerate` keeps the old corpus's rows (`0000000104-alter-
 * organizations-columns.sql`), the rebuilt corpus starts again at 1, and the
 * generator, which used to number from the files on disk alone, walks back up
 * through the old numbers. Sooner or later it writes a name the ledger already
 * has - and production, the database that most needs the change, skips it.
 *
 * So a generated name has to avoid three sets of names, not one:
 *
 *   - the files on disk (the corpus);
 *   - the ledger of the database at hand, when one can be read;
 *   - every name the corpus has had and since dropped, from git history. A
 *     row can only reach a production ledger from a file that was committed,
 *     so this is the one source that speaks for databases this machine cannot
 *     see, and it works with no database at all.
 *
 * Their ordinals are reserved, not just their exact names. Numbering continues
 * after the highest sequential ordinal among all three, so a rebuilt corpus
 * resumes after the old sequence instead of walking back through it, and two
 * branches that each ran a migration against a shared database do not end up
 * sharing a number. Timestamp-shaped ordinals (`make:migration` names such as
 * `1784267334-create-leads-table.sql`) are left out of that maximum: one stray
 * row whose file is long gone would otherwise renumber every later migration
 * as a timestamp. They are still reserved, so their exact numbers are never
 * reused either.
 *
 * Why not a checksum column in the ledger instead? The table belongs to
 * bun-query-builder, which records a row per file inside its own runner, and
 * several Stacks paths (the reconciler, ledger repair, regeneration) write
 * rows too. A column every one of them had to fill is not a backwards-
 * compatible change, and it would not help the case that matters: every row
 * written before the column existed - exactly the old corpus's rows - would
 * carry no checksum to compare. Not reusing a name is the guard that works for
 * ledgers that already exist.
 */

import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readdirSync, readFileSync } from 'node:fs'
import { basename, join } from 'node:path'
import { carriesGeneratedMarker } from './hand-written-migrations'
import { isPackageMigration } from './package-migrations'

/** The leading ordinal of a migration filename, or undefined when it has none. */
export function migrationNameOrdinal(file: string): number | undefined {
  const match = /^(\d+)[-_]/.exec(file)
  return match ? Number.parseInt(match[1]!, 10) : undefined
}

/**
 * Names the corpus directory has had in git history and no longer has.
 *
 * Renames are read as a delete plus an add (`--no-renames`), because a
 * renumbered file's OLD name is the one an older ledger recorded. A file
 * deleted and later put back exactly as it was (a reverted commit, restored)
 * is the same migration only when every historical deletion carried those
 * exact bytes. An older different migration may still be in a production
 * ledger, even if the latest deletion was restored identically. Outside a git
 * checkout, without git, or in a shallow clone that
 * has no history, this answers with whatever git can see, which may be
 * nothing.
 */
export function retiredMigrationNames(dir: string, options: { timeoutMs?: number } = {}): string[] {
  const git = (args: string[]) => spawnSync('git', args, {
    cwd: dir,
    encoding: 'utf8',
    timeout: options.timeoutMs ?? 10_000,
    maxBuffer: 64 * 1024 * 1024,
  })
  try {
    const result = git(['log', '--no-renames', '--diff-filter=D', '--raw', '--no-abbrev', '-z', '--pretty=format:', '--', '.'])
    if (result.status !== 0 || typeof result.stdout !== 'string')
      return []
    // Raw deletion records name the deleted blob itself. Keep every identity
    // instead of looking up only the newest deletion's parent. NUL-delimited
    // paths also avoid Git's quoting of spaces and non-ASCII filenames.
    const deletedObjects = new Map<string, Set<string>>()
    const records = result.stdout.split('\0')
    for (let index = 0; index < records.length; index++) {
      const deletion = /^:[0-7]{6} [0-7]{6} ([a-f0-9]{40}|[a-f0-9]{64}) 0+ D$/.exec(records[index]!.trim())
      if (!deletion) continue
      const path = records[++index]
      if (!path) continue
      const name = basename(path)
      if (!name.toLowerCase().endsWith('.sql')) continue
      const objects = deletedObjects.get(name) ?? new Set<string>()
      objects.add(deletion[1]!)
      deletedObjects.set(name, objects)
    }
    const names: string[] = []
    for (const [name, objects] of deletedObjects) {
      if (objects.size === 1) {
        try {
          const current = readFileSync(join(dir, name))
          const previous = objects.values().next().value!
          // Git hashes the blob header plus raw bytes, with the repository's
          // SHA1 or SHA256 object format. UTF8 decoding would merge different
          // invalid byte sequences into the same replacement character.
          const currentObject = createHash(previous.length === 64 ? 'sha256' : 'sha1')
            .update(`blob ${current.byteLength}\0`).update(current).digest('hex')
          if (currentObject === previous) continue
        }
        catch { /* Missing or unreadable current files keep the name reserved. */ }
      }
      names.push(name)
    }
    return names.sort()
  }
  catch {
    return []
  }
}

/**
 * Ordinals at or above this are `make:migration` timestamps (seconds or
 * milliseconds since 1970), not positions in a sequence.
 */
export const TIMESTAMP_MIGRATION_ORDINAL = 1_000_000_000

/**
 * The ordinal the next generated migration should take.
 *
 * One past the highest application ordinal on disk and the highest sequential
 * ordinal in `claimed` (ledger rows and retired names), then past any ordinal
 * `claimed` uses. A timestamp ordinal on disk still counts - that corpus is
 * numbered by time, and the next file has to sort after it - but one that only
 * the ledger or the history holds does not raise the floor. Package migrations
 * live in a reserved high band and are ignored on both sides, as they always
 * have been.
 */
export function nextMigrationOrdinal(diskFiles: readonly string[], claimed: readonly string[] = []): number {
  let max = 0
  for (const file of diskFiles) {
    if (isPackageMigration(file))
      continue
    const ordinal = migrationNameOrdinal(file)
    if (ordinal !== undefined)
      max = Math.max(max, ordinal)
  }
  const reserved = reservedMigrationOrdinals(claimed)
  for (const ordinal of reserved) {
    if (ordinal < TIMESTAMP_MIGRATION_ORDINAL)
      max = Math.max(max, ordinal)
  }
  return nextFreeMigrationOrdinal(max + 1, reserved)
}

/** The ordinals the claimed names use, minus the package band. */
export function reservedMigrationOrdinals(claimed: readonly string[]): Set<number> {
  const reserved = new Set<number>()
  for (const name of claimed) {
    if (isPackageMigration(name))
      continue
    const ordinal = migrationNameOrdinal(name)
    if (ordinal !== undefined)
      reserved.add(ordinal)
  }
  return reserved
}

/** The first ordinal at or after `from` that nothing has reserved. */
export function nextFreeMigrationOrdinal(from: number, reserved: ReadonlySet<number>): number {
  let cursor = from
  while (reserved.has(cursor))
    cursor += 1
  return cursor
}

export interface DuplicateMigrationOrdinal {
  /** The shared ordinal, as written in the filenames. */
  ordinal: string
  /** Every file carrying it, in run order. */
  files: string[]
}

/**
 * Ordinals more than one migration file carries.
 *
 * Two files with one number still run in a fixed order (the runner sorts by
 * full filename), but that order is the alphabet's, not the author's: two
 * branches that each generated `0000000129-*` merge into a corpus where an
 * `alter-` can run before the `create-` it depends on. It is also the
 * fingerprint of the generator having numbered without seeing everything.
 */
export function duplicateMigrationOrdinals(files: readonly string[]): DuplicateMigrationOrdinal[] {
  const byOrdinal = new Map<string, string[]>()
  for (const file of files) {
    if (!file.toLowerCase().endsWith('.sql'))
      continue
    const ordinal = /^(\d+)[-_]/.exec(file)?.[1]
    if (ordinal === undefined)
      continue
    const key = String(Number.parseInt(ordinal, 10))
    if (!byOrdinal.has(key))
      byOrdinal.set(key, [])
    byOrdinal.get(key)!.push(file)
  }
  return [...byOrdinal.values()]
    .filter(group => group.length > 1)
    .map((group) => {
      const sorted = [...group].sort()
      return { ordinal: /^(\d+)/.exec(sorted[0]!)![1]!, files: sorted }
    })
    .sort((a, b) => a.files[0]!.localeCompare(b.files[0]!))
}

/**
 * {@link duplicateMigrationOrdinals} for a corpus directory, with whether a
 * generator wrote any of each group's files.
 *
 * A group with a generated file is the generator numbering over something it
 * could not see - two branches that each generated the same ordinal - and is
 * worth a warning on every `migrate`. A group of hand-written files is history
 * (the framework's own default corpus has one) and only `--strict` refuses it.
 */
export function duplicateMigrationOrdinalsIn(dir: string): Array<DuplicateMigrationOrdinal & { generated: boolean }> {
  let files: string[]
  try {
    files = readdirSync(dir)
  }
  catch {
    return []
  }
  return duplicateMigrationOrdinals(files).map(group => ({
    ...group,
    generated: group.files.some((file) => {
      try {
        return carriesGeneratedMarker(readFileSync(join(dir, file), 'utf8'))
      }
      catch {
        return false
      }
    }),
  }))
}
