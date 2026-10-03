import type {
  GdprErasureResult,
  GdprExport,
  GdprModelChange,
  GdprModelPlan,
  GdprModels,
  GdprPlan,
  GdprPruneResult,
  GdprSubjectIdentity,
} from './types'
import { randomUUID } from 'node:crypto'
import { db, getDatabaseDialect, parseSqlDateTime, sqlDateTime } from '@stacksjs/database/runtime'
import { transaction } from '../transaction'
import { assertGdprPlan, GDPR_SUBJECT_MODEL, resolveGdprPlan } from './plan'

/**
 * Access, erasure and retention over the declared personal data
 * (stacksjs/stacks#365).
 *
 * Every write goes through the rows a subject link MATCHED - primary keys read
 * first, written second - never through a predicate re-evaluated at write
 * time. That is what keeps another subject's rows out of reach: an erasure can
 * only touch a row it has already shown belongs to the subject it was asked
 * about, and a dry run reports exactly the rows a real run would change.
 */

/** The audit ledger: one row per access request, erasure, and retention run that changed something. */
export const GDPR_AUDIT_TABLE = 'gdpr_requests'

const CHUNK = 500

type Row = Record<string, unknown>
// The tables here are named by model declarations at runtime, so the typed
// schema cannot describe them. One alias rather than a cast at every call.
type Handle = any

export interface GdprRunOptions {
  /** Model definitions to read. Defaults to the app's models over the framework defaults. */
  models?: GdprModels
  /** Who asked, recorded in the audit row: `cli`, `api:user:5`, `scheduler`. */
  actor?: string
}

export interface GdprEraseOptions extends GdprRunOptions {
  /** Report what would change and change nothing. */
  dryRun?: boolean
  /**
   * Revoke the subject's API tokens and destroy their sessions once the
   * erasure commits. Anonymizing the account does not end a session that is
   * already signed in, so this is on unless a caller has its own reason.
   * @default true
   */
  revokeCredentials?: boolean
}

export interface GdprPruneOptions extends GdprRunOptions {
  dryRun?: boolean
  /** The moment ages are measured from. @default new Date() */
  now?: Date
}

export class GdprSubjectNotFoundError extends Error {
  constructor(reference: number | string) {
    super(`No user matches '${String(reference)}'.`)
    this.name = 'GdprSubjectNotFoundError'
  }
}

async function loadPlan(models?: GdprModels): Promise<GdprPlan> {
  if (models)
    return assertGdprPlan(resolveGdprPlan(models))
  const { loadGdprModels } = await import('./models')
  return assertGdprPlan(resolveGdprPlan(await loadGdprModels()))
}

/**
 * The tables this database has, read from its catalog.
 *
 * Read rather than probed: probing a missing table is an error the query
 * logger reports, once per table, on every request. And unlike the FK audit's
 * reader this one does not swallow a failure into an empty set - an unreadable
 * catalog would otherwise make every table look absent, and an erasure would
 * report success having skipped all of them.
 */
async function liveTables(handle: Handle = db): Promise<Set<string> | null> {
  // The query-builder dialect: every MySQL- or Postgres-wire engine collapses to one of these.
  const dialect = String(getDatabaseDialect())
  const query = dialect === 'sqlite'
    ? `SELECT name FROM sqlite_master WHERE type = 'table'`
    : dialect === 'mysql'
      ? `SELECT TABLE_NAME AS name FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE()`
      : dialect === 'postgres'
        ? `SELECT table_name AS name FROM information_schema.tables WHERE table_schema = current_schema()`
        : null
  if (!query)
    return null
  const rows = await handle.unsafe(query).execute() as Array<{ name?: string, NAME?: string }>
  return new Set(rows.map(row => String(row.name ?? row.NAME ?? '').toLowerCase()).filter(Boolean))
}

const MISSING_TABLE = /no such table|does not exist|doesn't exist|unknown table|undefined table|ER_NO_SUCH_TABLE/i

/** Whether a table exists. Only a missing-table answer is "no"; anything else propagates. */
export async function gdprTableExists(table: string, handle: Handle = db): Promise<boolean> {
  const tables = await liveTables(handle)
  if (tables)
    return tables.has(table.toLowerCase())
  // A dialect with no catalog query here: ask the table for nothing.
  try {
    await handle.selectFrom(table).selectAll().limit(1).execute()
    return true
  }
  catch (error) {
    if (MISSING_TABLE.test(error instanceof Error ? error.message : String(error)))
      return false
    throw error
  }
}

function subjectPlanFor(plan: GdprPlan): { table: string, primaryKey: string } {
  const user = plan.models.find(model => model.model === GDPR_SUBJECT_MODEL)
  return { table: user?.table ?? 'users', primaryKey: user?.primaryKey ?? 'id' }
}

function normalizeReference(reference: number | string): { kind: 'id', value: number } | { kind: 'email', value: string } | { kind: 'uuid', value: string } {
  if (typeof reference === 'number')
    return { kind: 'id', value: reference }
  const trimmed = String(reference).trim()
  if (/^\d+$/.test(trimmed))
    return { kind: 'id', value: Number(trimmed) }
  if (trimmed.includes('@'))
    return { kind: 'email', value: trimmed }
  return { kind: 'uuid', value: trimmed }
}

/** Find the user a request is about, by id, email or uuid. */
export async function resolveGdprSubject(reference: number | string, options: GdprRunOptions = {}, handle: Handle = db): Promise<GdprSubjectIdentity | null> {
  const plan = await loadPlan(options.models)
  return findSubject(plan, reference, handle)
}

async function findSubject(plan: GdprPlan, reference: number | string, handle: Handle): Promise<GdprSubjectIdentity | null> {
  const { table, primaryKey } = subjectPlanFor(plan)
  const ref = normalizeReference(reference)

  let row: Row | undefined
  if (ref.kind === 'id') {
    row = (await handle.selectFrom(table).selectAll().where(primaryKey, '=', ref.value).limit(1).execute())[0]
  }
  else if (ref.kind === 'email') {
    for (const candidate of new Set([ref.value, ref.value.toLowerCase()])) {
      row = (await handle.selectFrom(table).selectAll().where('email', '=', candidate).limit(1).execute())[0]
      if (row)
        break
    }
  }
  else {
    row = (await handle.selectFrom(table).selectAll().where('uuid', '=', ref.value).limit(1).execute())[0]
  }

  if (!row)
    return null
  return { id: row[primaryKey] as number | string, email: typeof row.email === 'string' ? row.email : null }
}

function chunks<T>(values: T[], size = CHUNK): T[][] {
  const out: T[][] = []
  for (let i = 0; i < values.length; i += size)
    out.push(values.slice(i, i + size))
  return out
}

function dedupe(rows: Row[], primaryKey: string): Row[] {
  const seen = new Map<string, Row>()
  for (const row of rows)
    seen.set(String(row[primaryKey]), row)
  return [...seen.values()].sort((a, b) => String(a[primaryKey]).localeCompare(String(b[primaryKey]), undefined, { numeric: true }))
}

/**
 * The rows of one model that belong to the subject.
 *
 * Read in full, because erasure needs the current values to know what it
 * changes and export needs them to answer. `via` links recurse through the
 * parent's own match, memoized so a chain is walked once per request.
 */
async function matchRows(
  handle: Handle,
  plans: Map<string, GdprModelPlan>,
  model: GdprModelPlan,
  subject: GdprSubjectIdentity,
  memo: Map<string, Row[]>,
): Promise<Row[]> {
  const cached = memo.get(model.model)
  if (cached)
    return cached

  const link = model.subject
  let rows: Row[] = []

  if (link?.kind === 'column') {
    for (const column of link.columns) {
      let query = handle.selectFrom(model.table).selectAll().where(column, '=', subject.id)
      for (const [key, value] of Object.entries(link.where))
        query = query.where(key, '=', value)
      rows.push(...await query.execute())
    }
  }
  else if (link?.kind === 'email') {
    if (subject.email) {
      for (const candidate of new Set([subject.email, subject.email.toLowerCase()]))
        rows.push(...await handle.selectFrom(model.table).selectAll().where(link.column, '=', candidate).execute())
    }
  }
  else if (link?.kind === 'via') {
    const parent = plans.get(link.model)!
    const parentRows = await matchRows(handle, plans, parent, subject, memo)
    const parentIds = parentRows.map(row => row[parent.primaryKey]).filter(id => id !== null && id !== undefined)
    for (const ids of chunks(parentIds))
      rows.push(...await handle.selectFrom(model.table).selectAll().where(link.foreignKey, 'in', ids).execute())
  }

  rows = dedupe(rows, model.primaryKey)
  memo.set(model.model, rows)
  return rows
}

function exportable(value: unknown): unknown {
  if (typeof value === 'bigint')
    return Number.isSafeInteger(Number(value)) ? Number(value) : value.toString()
  if (value instanceof Date)
    return value.toISOString()
  return value
}

function project(model: GdprModelPlan, row: Row): Row {
  const out: Row = {}
  for (const column of model.exportColumns) {
    if (column in row)
      out[column] = exportable(row[column])
  }
  for (const field of model.personal) {
    if (field.export && field.column in row)
      out[field.column] = exportable(row[field.column])
  }
  return out
}

function targetValues(model: GdprModelPlan, row: Row): Row {
  const values: Row = {}
  for (const field of model.personal)
    values[field.column] = field.perRow ? `erased-${String(row[model.primaryKey])}` : field.anonymizeTo
  return values
}

/** Equal the way a database round trip makes things equal: SQLite hands back booleans as 0/1. */
function same(stored: unknown, target: unknown): boolean {
  if (stored === target)
    return true
  if (stored === null || stored === undefined || target === null || target === undefined)
    return (stored === null || stored === undefined) && (target === null || target === undefined)
  if (typeof target === 'boolean')
    return Number(stored) === Number(target)
  return String(stored) === String(target)
}

function needsAnonymizing(model: GdprModelPlan, row: Row): boolean {
  const target = targetValues(model, row)
  return Object.entries(target).some(([column, value]) => !same(row[column], value))
}

async function anonymizeRows(handle: Handle, model: GdprModelPlan, rows: Row[]): Promise<void> {
  if (!rows.length)
    return
  if (model.personal.some(field => field.perRow)) {
    for (const row of rows)
      await handle.updateTable(model.table).set(targetValues(model, row)).where(model.primaryKey, '=', row[model.primaryKey]).execute()
    return
  }
  const values = targetValues(model, rows[0]!)
  for (const ids of chunks(rows.map(row => row[model.primaryKey])))
    await handle.updateTable(model.table).set(values).where(model.primaryKey, 'in', ids).execute()
}

async function deleteRows(handle: Handle, model: GdprModelPlan, rows: Row[]): Promise<void> {
  for (const ids of chunks(rows.map(row => row[model.primaryKey])))
    await handle.deleteFrom(model.table).where(model.primaryKey, 'in', ids).execute()
}

async function recordAudit(handle: Handle, type: 'access' | 'erasure' | 'retention', subjectId: number | string | null, actor: string, summary: unknown): Promise<void> {
  const now = sqlDateTime(new Date())
  await handle.insertInto(GDPR_AUDIT_TABLE).values({
    uuid: randomUUID(),
    type,
    // An integer column, like the users key it names. A non-numeric key (a
    // userland User keyed by uuid) is recorded in the summary instead.
    subject_id: subjectId !== null && Number.isSafeInteger(Number(subjectId)) ? Number(subjectId) : null,
    actor,
    status: 'completed',
    summary: JSON.stringify(subjectId !== null && !Number.isSafeInteger(Number(subjectId)) ? { subject: String(subjectId), ...summary as object } : summary),
    occurred_at: now,
    created_at: now,
  }).execute()
}

async function requireAuditTable(): Promise<void> {
  if (!(await gdprTableExists(GDPR_AUDIT_TABLE)))
    throw new Error(`The '${GDPR_AUDIT_TABLE}' table does not exist, so this request cannot be recorded. Run \`buddy migrate\` first.`)
}

async function existingTables(models: GdprModelPlan[]): Promise<{ present: GdprModelPlan[], skipped: string[] }> {
  const present: GdprModelPlan[] = []
  const skipped: string[] = []
  const tables = await liveTables()
  const known = new Map<string, boolean>()
  for (const model of models) {
    if (!known.has(model.table))
      known.set(model.table, tables ? tables.has(model.table.toLowerCase()) : await gdprTableExists(model.table))
    if (known.get(model.table))
      present.push(model)
    else
      skipped.push(model.table)
  }
  return { present, skipped: [...new Set(skipped)].sort() }
}

/**
 * Everything the subject's declared personal data amounts to, as one document.
 *
 * Per model: the matching rows, carrying only the declared personal columns
 * plus the row's id, uuid and timestamps - never an undeclared column, so a
 * column added later is not exported until somebody classifies it. Alongside
 * the data, the purpose, basis and retention each model declares, which an
 * Article 15 answer owes the subject as well. Records an `access` audit row.
 */
export async function exportSubjectData(reference: number | string, options: GdprRunOptions = {}): Promise<GdprExport> {
  const plan = await loadPlan(options.models)
  const subject = await findSubject(plan, reference, db)
  if (!subject)
    throw new GdprSubjectNotFoundError(reference)

  await requireAuditTable()
  const linked = plan.models.filter(model => model.subject)
  const { present } = await existingTables(linked)
  const plans = new Map(present.map(model => [model.model, model]))
  // A via parent whose table is missing has no rows, so neither does its child.
  for (const model of present) {
    if (model.subject?.kind === 'via' && !plans.has(model.subject.model))
      plans.delete(model.model)
  }

  const memo = new Map<string, Row[]>()
  const data: GdprExport['data'] = {}
  const processing: GdprExport['processing'] = {}

  for (const model of [...plans.values()].sort((a, b) => a.model.localeCompare(b.model))) {
    const rows = await matchRows(db, plans, model, subject, memo)
    if (!rows.length)
      continue
    data[model.model] = rows.map(row => project(model, row))
    processing[model.model] = { purpose: model.purpose, basis: model.basis, retentionDays: model.retention?.days ?? null }
  }

  await recordAudit(db, 'access', subject.id, options.actor ?? 'system', {
    models: Object.fromEntries(Object.entries(data).map(([model, rows]) => [model, rows.length])),
  })

  return { subject: { id: subject.id }, generatedAt: new Date().toISOString(), data, processing }
}

/** Erasure order: children before parents, the subject's own row last. */
function erasureOrder(models: GdprModelPlan[]): GdprModelPlan[] {
  return [...models].sort((a, b) => {
    const aSelf = a.model === GDPR_SUBJECT_MODEL ? 1 : 0
    const bSelf = b.model === GDPR_SUBJECT_MODEL ? 1 : 0
    if (aSelf !== bSelf)
      return aSelf - bSelf
    if (a.depth !== b.depth)
      return b.depth - a.depth
    return a.model.localeCompare(b.model)
  })
}

/**
 * Erase a data subject, per each model's declaration.
 *
 * `delete` removes the matched rows, `anonymize` overwrites their personal
 * columns, `keep` leaves them (and is still reported, so the operator sees
 * what was retained and can say why). All of it in one transaction with the
 * audit row, so an erasure is either recorded and complete or neither.
 *
 * Idempotent: a second run matches what the first left behind and finds
 * nothing to change. A dry run reads the same rows and writes nothing, so its
 * report is exactly what a real run would do.
 */
export async function eraseSubject(reference: number | string, options: GdprEraseOptions = {}): Promise<GdprErasureResult> {
  const dryRun = options.dryRun === true
  const plan = await loadPlan(options.models)
  const subject = await findSubject(plan, reference, db)
  if (!subject)
    throw new GdprSubjectNotFoundError(reference)

  if (!dryRun)
    await requireAuditTable()

  const linked = plan.models.filter(model => model.subject)
  const { present, skipped } = await existingTables(linked)
  const plans = new Map(present.map(model => [model.model, model]))
  for (const model of present) {
    if (model.subject?.kind === 'via' && !plans.has(model.subject.model))
      plans.delete(model.model)
  }

  const work = async (handle: Handle): Promise<GdprModelChange[]> => {
    const memo = new Map<string, Row[]>()
    // Every match is read before anything is written: a child found `via` a
    // parent has to be matched while the parent row still says whose it is.
    for (const model of plans.values())
      await matchRows(handle, plans, model, subject, memo)

    const changes: GdprModelChange[] = []
    for (const model of erasureOrder([...plans.values()])) {
      const rows = memo.get(model.model) ?? []
      if (model.erasure === 'delete') {
        if (!dryRun)
          await deleteRows(handle, model, rows)
        changes.push({ model: model.model, table: model.table, action: 'delete', matched: rows.length, changed: rows.length, fields: [] })
      }
      else if (model.erasure === 'anonymize') {
        const pending = rows.filter(row => needsAnonymizing(model, row))
        if (!dryRun)
          await anonymizeRows(handle, model, pending)
        changes.push({ model: model.model, table: model.table, action: 'anonymize', matched: rows.length, changed: pending.length, fields: model.personal.map(field => field.column) })
      }
      else {
        changes.push({ model: model.model, table: model.table, action: 'keep', matched: rows.length, changed: 0, fields: [] })
      }
    }

    if (!dryRun) {
      await recordAudit(handle, 'erasure', subject.id, options.actor ?? 'system', {
        changes: changes.map(({ model, action, matched, changed }) => ({ model, action, matched, changed })),
        skipped,
      })
    }
    return changes
  }

  const changes = dryRun ? await work(db) : await transaction(work)

  let credentialsRevoked = false
  if (!dryRun && options.revokeCredentials !== false)
    credentialsRevoked = await revokeCredentials(subject.id)

  return { subject: { id: subject.id }, dryRun, changes: changes.sort((a, b) => a.model.localeCompare(b.model)), skipped, credentialsRevoked }
}

/**
 * End every session the subject still holds.
 *
 * After the commit, not inside it: the auth layer runs its own transactions,
 * and on SQLite a second writer inside an open one waits on itself. Failing
 * here propagates - the data is already erased, re-running is safe, and a
 * reported success that left a token alive would be the worse outcome.
 */
async function revokeCredentials(subjectId: number | string): Promise<boolean> {
  let auth: { revokeAllTokens?: (id: number) => Promise<void>, sessionDestroyAll?: (id: number) => Promise<void> }
  try {
    auth = await import('@stacksjs/auth') as typeof auth
  }
  catch {
    return false
  }

  const id = Number(subjectId)
  if (!Number.isSafeInteger(id))
    return false

  if (auth.revokeAllTokens && await gdprTableExists('oauth_access_tokens'))
    await auth.revokeAllTokens(id)
  if (auth.sessionDestroyAll)
    await auth.sessionDestroyAll(id)
  return true
}

const DAY_MS = 86_400_000

/**
 * Apply every model's retention policy.
 *
 * Candidate rows are read with a string bound one day past the cutoff and then
 * compared as dates. Stored timestamps come in two spellings - the database
 * clock's `YYYY-MM-DD HH:MM:SS` and the framework's `YYYY-MM-DDTHH:MM:SS.sss`
 * - and comparing either against the other as a string is off by up to a day
 * in the direction of deleting too much. The wider bound can only over-select,
 * and the date comparison removes what it over-selected.
 *
 * One transaction per model, so a large table does not hold a lock over the
 * whole run, with a `retention` audit row when anything changed.
 */
export async function pruneRetainedData(options: GdprPruneOptions = {}): Promise<GdprPruneResult> {
  const dryRun = options.dryRun === true
  const now = options.now ?? new Date()
  const plan = await loadPlan(options.models)
  const policies = plan.models.filter(model => model.retention)
  if (!policies.length)
    return { dryRun, cutoffs: {}, changes: [], skipped: [] }

  if (!dryRun)
    await requireAuditTable()

  const { present, skipped } = await existingTables(policies)
  const changes: GdprModelChange[] = []
  const cutoffs: Record<string, string> = {}

  for (const model of present) {
    const retention = model.retention!
    const cutoff = new Date(now.getTime() - retention.days * DAY_MS)
    const bound = sqlDateTime(new Date(cutoff.getTime() + DAY_MS))
    cutoffs[model.model] = cutoff.toISOString()

    const expired: Row[] = []
    let last: unknown
    for (;;) {
      const handle: Handle = db
      let query = handle.selectFrom(model.table).selectAll().where(retention.column, '<', bound)
      if (last !== undefined)
        query = query.where(model.primaryKey, '>', last)
      const page: Row[] = await query.orderBy(model.primaryKey, 'asc').limit(CHUNK).execute()
      if (!page.length)
        break
      for (const row of page) {
        const at = parseSqlDateTime(row[retention.column])
        if (at && at.getTime() < cutoff.getTime())
          expired.push(row)
      }
      last = page[page.length - 1]![model.primaryKey]
      if (page.length < CHUNK)
        break
    }

    const pending = retention.action === 'delete' ? expired : expired.filter(row => needsAnonymizing(model, row))
    if (!dryRun && pending.length) {
      await transaction(async (handle: Handle) => {
        if (retention.action === 'delete')
          await deleteRows(handle, model, pending)
        else
          await anonymizeRows(handle, model, pending)
      })
    }

    changes.push({
      model: model.model,
      table: model.table,
      action: retention.action,
      matched: expired.length,
      changed: pending.length,
      fields: retention.action === 'anonymize' ? model.personal.map(field => field.column) : [],
    })
  }

  if (!dryRun && changes.some(change => change.changed > 0)) {
    await recordAudit(db, 'retention', null, options.actor ?? 'scheduler', {
      changes: changes.map(({ model, action, matched, changed }) => ({ model, action, matched, changed })),
      cutoffs,
    })
  }

  return { dryRun, cutoffs, changes: changes.sort((a, b) => a.model.localeCompare(b.model)), skipped }
}
