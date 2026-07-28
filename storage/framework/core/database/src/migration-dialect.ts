/**
 * Dialect classification for the committed migration corpus.
 *
 * `database/migrations/` is a single flat, git-tracked directory holding
 * dialect-SPECIFIC DDL under a dialect-ANONYMOUS name. The generator knows
 * which dialect it emitted for (it passes `getQbDialect()` into
 * bun-query-builder and writes a dialect-keyed model snapshot), but the writer
 * throws that knowledge away, and the executor hands each file straight to the
 * server without looking at it. Nothing in between verifies that the SQL on
 * disk matches the database it is about to be replayed against.
 *
 * The visible symptom is a user setting DB_CONNECTION=postgres and getting
 * `syntax error at or near "AUTOINCREMENT"` on migration 1 of 121, with
 * nothing pointing at the real cause. This module exists so that failure
 * happens before a single statement runs, and says what is actually wrong.
 *
 * Deliberately SOUND rather than COMPLETE: it only reports a mismatch on
 * markers that cannot legitimately appear in the target dialect, and it strips
 * comments and quoted text first so a column named "serial" or a `-- Skipped:
 * ... ALTER TABLE ADD CONSTRAINT` note cannot trigger it. False negatives are
 * acceptable here; false positives would block working installs.
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

export type MigrationDialect = 'sqlite' | 'postgres' | 'mysql'

export interface DialectMarker {
  dialect: MigrationDialect
  /** The literal token found, for the error message. */
  marker: string
  file: string
  line: number
  /** The source line, trimmed, for context. */
  snippet: string
}

export interface MigrationCorpusAudit {
  /** Files examined (.sql only). */
  total: number
  /** The dialect the corpus appears to be written for, when it is unambiguous. */
  inferred: MigrationDialect | null
  /** Markers that cannot run on the target dialect. */
  incompatible: DialectMarker[]
  /** True when the directory does not exist or holds no .sql files. */
  empty: boolean
}

/**
 * Markers that are exclusive to one dialect.
 *
 * Kept tight on purpose. `SERIAL` is the only entry with real ambiguity (it is
 * a plausible column name), which is why matching runs after quoted
 * identifiers and string literals are stripped.
 */
const MARKERS: Array<{ dialect: MigrationDialect, pattern: RegExp, label: string }> = [
  // SQLite. No other supported dialect accepts these.
  { dialect: 'sqlite', pattern: /\bAUTOINCREMENT\b/i, label: 'AUTOINCREMENT' },
  { dialect: 'sqlite', pattern: /\bWITHOUT\s+ROWID\b/i, label: 'WITHOUT ROWID' },
  { dialect: 'sqlite', pattern: /\bPRAGMA\b/i, label: 'PRAGMA' },

  // MySQL / SingleStore.
  { dialect: 'mysql', pattern: /\bAUTO_INCREMENT\b/i, label: 'AUTO_INCREMENT' },
  { dialect: 'mysql', pattern: /\bENGINE\s*=/i, label: 'ENGINE=' },

  // Postgres.
  { dialect: 'postgres', pattern: /\bBIGSERIAL\b/i, label: 'BIGSERIAL' },
  { dialect: 'postgres', pattern: /\bSERIAL\b/i, label: 'SERIAL' },
  { dialect: 'postgres', pattern: /\bCREATE\s+TYPE\b/i, label: 'CREATE TYPE' },
  { dialect: 'postgres', pattern: /\bGENERATED\s+(?:ALWAYS|BY\s+DEFAULT)\s+AS\s+IDENTITY\b/i, label: 'GENERATED AS IDENTITY' },
]

/**
 * Blank out comments and quoted text, preserving offsets so reported line
 * numbers still point at the real source line.
 *
 * This is the whole reason `migrate:switch` was reporting 40 foreign-key
 * migrations that do not exist: it regex-matched raw file content, so the
 * words inside `-- Skipped: SQLite does not support ALTER TABLE ADD
 * CONSTRAINT` counted as an ALTER TABLE ADD CONSTRAINT.
 */
export function stripSqlNoise(sql: string): string {
  let out = ''
  let i = 0

  const blank = (text: string) => text.replace(/[^\n]/g, ' ')

  while (i < sql.length) {
    const rest = sql.slice(i)

    // Line comment.
    const line = rest.match(/^--[^\n]*/)
    if (line) {
      out += blank(line[0])
      i += line[0].length
      continue
    }

    // Block comment. Unterminated blocks blank to end of input.
    if (rest.startsWith('/*')) {
      const end = rest.indexOf('*/')
      const chunk = end === -1 ? rest : rest.slice(0, end + 2)
      out += blank(chunk)
      i += chunk.length
      continue
    }

    // Quoted identifier or string literal. Doubling is the escape in SQL
    // ("" and ''), and blanking the closing quote makes a doubled pair read
    // as two adjacent empty runs, which is harmless for marker matching.
    const quote = rest[0]
    if (quote === '"' || quote === '\'' || quote === '`') {
      let j = 1
      while (j < rest.length && rest[j] !== quote) j++
      const chunk = rest.slice(0, Math.min(j + 1, rest.length))
      out += blank(chunk)
      i += chunk.length
      continue
    }

    out += sql[i]
    i += 1
  }

  return out
}

/** Find dialect-exclusive markers in one file's SQL. */
export function classifyMigrationSql(sql: string, file: string): DialectMarker[] {
  const cleaned = stripSqlNoise(sql)
  const lines = cleaned.split('\n')
  const rawLines = sql.split('\n')
  const found: DialectMarker[] = []

  for (let index = 0; index < lines.length; index++) {
    for (const { dialect, pattern, label } of MARKERS) {
      if (pattern.test(lines[index] ?? '')) {
        found.push({
          dialect,
          marker: label,
          file,
          line: index + 1,
          snippet: (rawLines[index] ?? '').trim().slice(0, 120),
        })
      }
    }
  }

  return found
}

/**
 * Audit a whole migration directory against the dialect it is about to run on.
 *
 * `inferred` is only set when every marker found agrees, so a genuinely mixed
 * or portable corpus reports `null` rather than a misleading guess.
 */
export function auditMigrationCorpus(options: {
  dir: string
  target: MigrationDialect
}): MigrationCorpusAudit {
  const { dir, target } = options

  if (!existsSync(dir))
    return { total: 0, inferred: null, incompatible: [], empty: true }

  let files: string[]
  try {
    files = readdirSync(dir).filter(f => f.endsWith('.sql')).sort()
  }
  catch {
    return { total: 0, inferred: null, incompatible: [], empty: true }
  }

  const all: DialectMarker[] = []
  for (const file of files) {
    let sql: string
    try {
      sql = readFileSync(join(dir, file), 'utf8')
    }
    catch {
      continue
    }
    all.push(...classifyMigrationSql(sql, file))
  }

  const dialects = new Set(all.map(m => m.dialect))

  return {
    total: files.length,
    inferred: dialects.size === 1 ? ([...dialects][0] ?? null) : null,
    // SingleStore speaks the MySQL wire protocol, so a mysql-marked corpus is
    // fine there; callers pass the collapsed dialect.
    incompatible: all.filter(m => m.dialect !== target),
    empty: files.length === 0,
  }
}

/** Environment escape hatch, for an operator whose corpus is genuinely fine. */
export const DIALECT_OVERRIDE_ENV = 'STACKS_ALLOW_DIALECT_MISMATCH'

/**
 * The user-facing explanation. Long on purpose: this replaces a raw
 * `syntax error at or near "AUTOINCREMENT"` that told the user nothing about
 * why their brand new project could not migrate.
 */
export function formatMigrationDialectError(audit: MigrationCorpusAudit, target: MigrationDialect, dir: string): string {
  const affected = new Set(audit.incompatible.map(m => m.file))
  const sample = audit.incompatible.slice(0, 3)
  const inferred = audit.inferred ? `${audit.inferred}-flavoured` : 'written for a different database'

  const lines = [
    `The migration files in ${dir} are ${inferred} and cannot run on ${target}.`,
    `${affected.size} of ${audit.total} files use SQL that ${target} does not accept. For example:`,
    ...sample.map(m => `  ${m.file}:${m.line}  ${m.marker}`),
    '',
    `Nothing was migrated, so the database is unchanged.`,
    '',
    `Stacks ships one set of migration files, and they are emitted for a single database.`,
    `To use ${target}, regenerate them from your models against ${target}, or point`,
    `DB_CONNECTION back at the database they were written for.`,
    '',
    `If you know this corpus is correct, re-run with ${DIALECT_OVERRIDE_ENV}=1 to proceed anyway.`,
  ]

  return lines.join('\n')
}
