/**
 * DDL constraint audit.
 *
 * `./migration-dialect` answers "was this corpus written for a different
 * *database*?" by looking for dialect-exclusive syntax. This module answers
 * a different question: "does this corpus use a *feature* the target
 * database does not implement?"
 *
 * They are genuinely distinct. `FOREIGN KEY` is valid MySQL syntax and
 * appears in a perfectly well-formed MySQL corpus, so the dialect auditor
 * correctly says nothing about it. Point that same corpus at Vitess or
 * SingleStore — both of which speak MySQL and are therefore invisible to a
 * syntax check — and every foreign key is rejected, because a distributed
 * engine cannot enforce one across shards.
 *
 * Without this audit that failure arrives mid-migration, as a bare
 * `unsupported: foreign key constraints` on file 40 of 121, with 39 tables
 * already created. The point is to fail before the first statement runs and
 * to say which capability is missing and what to do instead.
 *
 * Deliberately SOUND rather than COMPLETE, matching `./migration-dialect`:
 * it only flags constructs that definitely cannot work, and it strips
 * comments and quoted text first so a column named `auto_increment_id` or a
 * `-- no FOREIGN KEY here` note cannot trigger it. Missing a real violation
 * costs a clear error message; a false positive blocks a working install.
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { DialectCapabilities } from './dialect'
import { dialectCapabilities } from './dialect'
import { stripSqlNoise } from './migration-dialect'

/** The capability a construct requires. */
export type DdlCapability = 'foreignKeys' | 'autoIncrement' | 'createIndexIfNotExists'

export interface DdlViolation {
  /** Which capability the target lacks. */
  capability: DdlCapability
  /** The literal construct found, for the error message. */
  construct: string
  file: string
  line: number
  /** The source line, trimmed, for context. */
  snippet: string
}

export interface DdlConstraintAudit {
  /** Files examined (.sql only). */
  total: number
  /** Constructs the target dialect cannot accept. */
  violations: DdlViolation[]
  /** True when the directory does not exist or holds no .sql files. */
  empty: boolean
}

/**
 * Constructs that require a capability.
 *
 * `AUTO_INCREMENT` is matched only in its DDL form. It also appears as a
 * table option (`ENGINE=InnoDB AUTO_INCREMENT=5`), but on a dialect without
 * the capability that option is inert rather than fatal, and flagging it
 * would make the audit reject corpora that would actually migrate.
 */
const CONSTRUCTS: Array<{ capability: DdlCapability, pattern: RegExp, label: string }> = [
  { capability: 'foreignKeys', pattern: /\bFOREIGN\s+KEY\b/i, label: 'FOREIGN KEY' },
  // Matched as a bare keyword, deliberately. An earlier version required a
  // following identifier character (`REFERENCES\s+[`"\w]`) and therefore
  // missed every real foreign key in the shipped corpus: `stripSqlNoise`
  // blanks quoted identifiers, so `REFERENCES "users"("id")` arrives here as
  // `REFERENCES        (    )` and the identifier the pattern was looking for
  // is gone. Quoted is the common form, so the rule matched almost nothing.
  //
  // The bare keyword is safe because this runs on stripped SQL: a column
  // named `references` is a reserved word that must be quoted, and quoted
  // text has already been blanked out.
  { capability: 'foreignKeys', pattern: /\bREFERENCES\b/i, label: 'REFERENCES' },
  { capability: 'autoIncrement', pattern: /\bAUTO_INCREMENT\b(?!\s*=)/i, label: 'AUTO_INCREMENT' },
  { capability: 'createIndexIfNotExists', pattern: /\bCREATE\s+(?:UNIQUE\s+)?INDEX\s+IF\s+NOT\s+EXISTS\b/i, label: 'CREATE INDEX IF NOT EXISTS' },
]

/** Whether the target supports the capability a construct needs. */
function supports(caps: DialectCapabilities, capability: DdlCapability): boolean {
  switch (capability) {
    case 'foreignKeys':
      return caps.supportsForeignKeys
    case 'autoIncrement':
      return caps.supportsAutoIncrement
    case 'createIndexIfNotExists':
      return caps.supportsCreateIndexIfNotExists
  }
}

/** Find capability violations in one file's SQL. */
export function auditDdlSql(sql: string, file: string, dialect: string): DdlViolation[] {
  const caps = dialectCapabilities(dialect)
  const cleaned = stripSqlNoise(sql)
  const lines = cleaned.split('\n')
  const rawLines = sql.split('\n')
  const found: DdlViolation[] = []

  for (let index = 0; index < lines.length; index++) {
    for (const { capability, pattern, label } of CONSTRUCTS) {
      if (supports(caps, capability))
        continue
      if (pattern.test(lines[index] ?? '')) {
        found.push({
          capability,
          construct: label,
          file,
          line: index + 1,
          snippet: (rawLines[index] ?? '').trim().slice(0, 120),
        })
      }
    }
  }

  return found
}

/** Audit a whole migration directory against the target dialect's capabilities. */
export function auditDdlConstraints(options: {
  dir: string
  dialect: string
}): DdlConstraintAudit {
  const { dir, dialect } = options

  if (!existsSync(dir))
    return { total: 0, violations: [], empty: true }

  let files: string[]
  try {
    files = readdirSync(dir).filter(f => f.endsWith('.sql')).sort()
  }
  catch {
    return { total: 0, violations: [], empty: true }
  }

  const violations: DdlViolation[] = []
  for (const file of files) {
    let sql: string
    try {
      sql = readFileSync(join(dir, file), 'utf8')
    }
    catch {
      continue
    }
    violations.push(...auditDdlSql(sql, file, dialect))
  }

  return { total: files.length, violations, empty: files.length === 0 }
}

/** Environment escape hatch, matching the dialect auditor's. */
export const DDL_CONSTRAINT_OVERRIDE_ENV = 'STACKS_ALLOW_DDL_CONSTRAINT_VIOLATIONS'

/**
 * What to do about each missing capability.
 *
 * Every message names a concrete next step. A user who is told only that
 * their database "does not support foreign keys" has learned nothing they
 * can act on; the fix is a model trait or a regeneration flag, and that is
 * what belongs in the error.
 */
const REMEDIES: Record<DdlCapability, string> = {
  foreignKeys: [
    'Distributed engines cannot enforce a foreign key across shards, so referential',
    'integrity has to move into the application. Regenerate the corpus for this',
    'dialect — the generator emits the backing index without the constraint — and',
    'rely on the model relationships plus `buddy doctor` (which reports orphan rows)',
    'instead of database-level cascades.',
  ].join('\n'),
  autoIncrement: [
    'Every shard would hand out the same AUTO_INCREMENT values and collide, so the',
    'primary key has to come from somewhere else. Add `useUuid: true` to the model',
    'traits for an application-generated key, or back the table with a sequence in',
    'an unsharded keyspace and reference it from the VSchema.',
  ].join('\n'),
  createIndexIfNotExists: [
    'MySQL has no `CREATE INDEX IF NOT EXISTS` form and rejects it as a syntax',
    'error. Regenerate the corpus for this dialect: the generator emits a bare',
    '`CREATE INDEX` and treats the duplicate-key error on replay as success.',
  ].join('\n'),
}

/**
 * The user-facing explanation.
 *
 * Grouped by capability rather than by file: twenty foreign keys across
 * eighteen files are one decision to make, not twenty, and listing them
 * per-file buries that.
 */
export function formatDdlConstraintError(audit: DdlConstraintAudit, dialect: string, dir: string): string {
  const byCapability = new Map<DdlCapability, DdlViolation[]>()
  for (const violation of audit.violations) {
    const bucket = byCapability.get(violation.capability) ?? []
    bucket.push(violation)
    byCapability.set(violation.capability, bucket)
  }

  const lines = [
    `The migration files in ${dir} use SQL features that ${dialect} does not implement.`,
    '',
    `Nothing was migrated, so the database is unchanged.`,
    '',
  ]

  for (const [capability, found] of byCapability) {
    const files = new Set(found.map(v => v.file))
    lines.push(`${found.length} use(s) of ${found[0]?.construct} across ${files.size} file(s), for example:`)
    for (const violation of found.slice(0, 3))
      lines.push(`  ${violation.file}:${violation.line}  ${violation.snippet}`)
    lines.push('')
    lines.push(REMEDIES[capability])
    lines.push('')
  }

  lines.push(`If you know this corpus is correct, re-run with ${DDL_CONSTRAINT_OVERRIDE_ENV}=1 to proceed anyway.`)

  return lines.join('\n')
}
