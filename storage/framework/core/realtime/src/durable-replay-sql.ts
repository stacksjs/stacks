import type { DurableReplayMessage, DurableReplayOptions, DurableReplayStore, ReplayState } from './durable-replay-contract'
import { channelName, DurableReplayError, prepareAppend, readInput, replayGap, replayOptions, replayPage } from './durable-replay-contract'

type Row = Record<string, unknown>
export type ReplaySqlQuery = (sql: string, values: unknown[]) => Promise<Row[]> | Row[]
export interface SqlDurableReplayOptions extends DurableReplayOptions {
  dialect: 'sqlite' | 'postgres'
  tables: { channels: string, events: string }
  /** Must BEGIN, provide one transaction-bound query handle, COMMIT/ROLLBACK,
   * and retain UPDATE row locks until commit. Resolve only after durable commit;
   * a nested savepoint is insufficient for publication. No pool-level query. */
  transaction: <T>(callback: (query: ReplaySqlQuery) => Promise<T>) => Promise<T>
  /** Immutable server-selected partition columns. These are not authorization. */
  scope?: Readonly<Record<string, string | number>>
}
const reserved = new Set(['id', 'name', 'incarnation', 'high_water_mark', 'pruned_through', 'last_recorded_at', 'policy', 'channel_id', 'seq', 'operation_key', 'fingerprint', 'event', 'payload', 'recorded_at'])
function identifier(value: string) {
  if (typeof value !== 'string' || !/^[a-z][a-z0-9_]{0,62}$/.test(value)) throw new TypeError('Invalid replay SQL identifier')
  return `"${value}"`
}
function sequence(value: unknown): number {
  const number = typeof value === 'number' ? value : typeof value === 'bigint' || typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : NaN
  if (!Number.isSafeInteger(number) || number < 0) throw new DurableReplayError('replay_storage_invalid', 'Replay checkpoint is invalid')
  return number
}
function message(row: Row): DurableReplayMessage { return { seq: sequence(row.seq), ts: sequence(row.recorded_at), event: String(row.event), data: JSON.parse(String(row.payload)) } }

/** Production SQL implementation over app-owned, model-generated tables. Never runs DDL. */
export function createSqlDurableReplayStore(options: SqlDurableReplayOptions): DurableReplayStore {
  if (!['sqlite', 'postgres'].includes(options.dialect) || typeof options.transaction !== 'function') throw new TypeError('Replay requires a supported transactional SQL adapter')
  const channels = identifier(options.tables.channels), events = identifier(options.tables.events), dialect = options.dialect
  const configuration = replayOptions(options), transaction = options.transaction.bind(options)
  const scope = Object.entries(options.scope ?? {}).sort(([a], [b]) => a.localeCompare(b))
  if (scope.length > 8) throw new TypeError('Replay partition exceeds its column bound')
  for (const [column, value] of scope) {
    identifier(column)
    if (reserved.has(column) || !(typeof value === 'string' && value.length > 0 && value.length <= 200 || typeof value === 'number' && Number.isSafeInteger(value))) throw new TypeError('Invalid immutable replay partition')
  }
  const predicates = scope.map(([name]) => `${identifier(name)} = ?`), scopeValues = scope.map(([, value]) => value)
  async function locked<T>(name: string, operation: (state: ReplayState, run: (sql: string, values?: unknown[]) => Promise<Row[]>, row: Row, prune: () => Promise<void>) => Promise<T>): Promise<T> {
    channelName(name)
    return await transaction(async (query) => {
      if (typeof query !== 'function') throw new TypeError('Replay transaction must supply its own query handle')
      const run = async (sql: string, values: unknown[] = []) => { let index = 0; return await query(dialect === 'postgres' ? sql.replace(/\?/g, () => `$${++index}`) : sql, values) }
      const columns = [...scope.map(([column]) => identifier(column)), 'name', 'incarnation', 'high_water_mark', 'pruned_through', 'last_recorded_at', 'policy']
      const values = [...scopeValues, name, configuration.newIncarnation(), 0, 0, 0, configuration.policyKey]
      await run(`INSERT INTO ${channels} (${columns.join(', ')}) VALUES (${values.map(() => '?').join(', ')}) ON CONFLICT DO NOTHING`, values)
      // INSERT conflict resolution and this point UPDATE serialize a new or
      // existing checkpoint across processes, on SQLite and PostgreSQL.
      const row = (await run(`UPDATE ${channels} SET name = name WHERE ${[...predicates, 'name = ?'].join(' AND ')} RETURNING *`, [...scopeValues, name]))[0]
      if (!row || row.policy !== configuration.policyKey) throw new DurableReplayError('replay_policy_mismatch', 'Replay channel policy differs from its persisted configuration')
      const channelId = row.id
      const state: ReplayState = { incarnation: String(row.incarnation), highWaterMark: sequence(row.high_water_mark), prunedThrough: sequence(row.pruned_through), lastRecordedAt: sequence(row.last_recorded_at) }
      const eventWhere = ['channel_id = ?', ...predicates].join(' AND '), eventValues = [row.id, ...scopeValues]
      async function prune() {
        const cutoff = Math.max(configuration.now(), state.lastRecordedAt) - configuration.policy.ttlMs
        const expired = (await run(`SELECT MAX(seq) AS expired FROM ${events} WHERE ${eventWhere} AND recorded_at <= ?`, [...eventValues, cutoff]))[0]?.expired
        const floor = Math.max(state.prunedThrough, state.highWaterMark - configuration.policy.maxEvents, expired === null || expired === undefined ? 0 : sequence(expired))
        if (floor > state.prunedThrough) {
          await run(`DELETE FROM ${events} WHERE ${eventWhere} AND seq <= ?`, [...eventValues, floor])
          await run(`UPDATE ${channels} SET pruned_through = ? WHERE id = ? AND ${predicates.length ? predicates.join(' AND ') : '1 = 1'}`, [floor, channelId, ...scopeValues])
          state.prunedThrough = floor
        }
      }
      await prune()
      return await operation(state, run, row, prune)
    })
  }
  return {
    async append(input) {
      const prepared = prepareAppend(input, configuration.policy)
      return await locked(prepared.channel, async (state, run, row, prune) => {
        const prior = (await run(`SELECT * FROM ${events} WHERE channel_id = ? AND ${[...predicates, 'operation_key = ?'].join(' AND ')}`, [row.id, ...scopeValues, prepared.operationKey]))[0]
        if (prior) {
          if (prior.fingerprint !== prepared.fingerprint) throw new DurableReplayError('replay_idempotency_conflict', 'Operation ID was used with different event data')
          const retained = message(prior)
          return { message: retained, cursor: { incarnation: state.incarnation, seq: retained.seq }, duplicate: true }
        }
        if (state.highWaterMark === Number.MAX_SAFE_INTEGER) throw new DurableReplayError('replay_sequence_exhausted', 'Channel sequence is exhausted')
        const seq = state.highWaterMark + 1, ts = Math.max(configuration.now(), state.lastRecordedAt)
        const columns = [...scope.map(([column]) => identifier(column)), 'channel_id', 'seq', 'operation_key', 'fingerprint', 'event', 'payload', 'recorded_at']
        const values = [...scopeValues, row.id, seq, prepared.operationKey, prepared.fingerprint, prepared.event, prepared.payload, ts]
        await run(`INSERT INTO ${events} (${columns.join(', ')}) VALUES (${values.map(() => '?').join(', ')})`, values)
        await run(`UPDATE ${channels} SET high_water_mark = ?, last_recorded_at = ? WHERE id = ? AND ${predicates.length ? predicates.join(' AND ') : '1 = 1'}`, [seq, ts, row.id, ...scopeValues])
        state.highWaterMark = seq; state.lastRecordedAt = ts
        await prune()
        return { message: { seq, ts, event: prepared.event, data: JSON.parse(prepared.payload) }, cursor: { incarnation: state.incarnation, seq }, duplicate: false }
      })
    },
    async replay(input) {
      const read = readInput(input)
      return await locked(input.channel, async (state, run, row) => {
        const rows = replayGap(state, read.after) ? [] : await run(`SELECT seq, recorded_at, event, payload FROM ${events} WHERE channel_id = ? AND ${[...predicates, 'seq > ?'].join(' AND ')} ORDER BY seq ASC LIMIT ?`, [row.id, ...scopeValues, read.after?.seq ?? 0, read.limit])
        const messages = rows.map(message)
        // A missing committed event is corruption/deletion, not a safe cursor
        // advance. Retention only removes a prefix and persists its floor.
        if (messages.some((entry, index) => entry.seq !== (read.after?.seq ?? 0) + index + 1) || !replayGap(state, read.after) && messages.length !== Math.min(read.limit, state.highWaterMark - (read.after?.seq ?? 0))) throw new DurableReplayError('replay_storage_gap', 'Replay storage contains an unexplained sequence gap')
        return replayPage(state, read.after, messages, configuration.policy.maxReplayBytes)
      })
    },
    async prune(channel) { return await locked(channel, async state => ({ prunedThrough: state.prunedThrough, head: { incarnation: state.incarnation, seq: state.highWaterMark } })) },
  }
}
