import assert from 'node:assert/strict'

const dialect = process.env.DB_CONNECTION
assert(dialect === 'mysql' || dialect === 'postgres')
assert(process.env.DB_DATABASE?.startsWith('stacks_query_log_'))
assert(['localhost', '127.0.0.1', '[::1]'].includes(process.env.DB_HOST!))
const { config, overridesReady } = await import('@stacksjs/config')
await overridesReady
const { db, ensureDatabaseConfigLoaded, initializeDbConfig, resetDatabaseConnection } = await import('../../src/utils')
await ensureDatabaseConfigLoaded()
initializeDbConfig({ app: { env: 'test' }, database: {
  default: dialect,
  connections: { [dialect]: { name: process.env.DB_DATABASE, host: process.env.DB_HOST, port: Number(process.env.DB_PORT), username: process.env.DB_USERNAME, password: process.env.DB_PASSWORD } },
  queryLogging: { enabled: false },
} })
config.database.queryLogging = { ...config.database.queryLogging, enabled: true, excludedQueries: [], analysis: { enabled: false } }
const { logQuery } = await import('../../src/query-logger')

// Application-wide policy for the application's own transactions. Query-log
// batches are written in the background after ANY query, so they must never
// reach these observers or be retried and re-inserted because of them.
const observed: string[] = []
db.setTransactionDefaults({
  retries: 1,
  afterCommit: () => {
    observed.push('afterCommit')
    throw new Error('application observer failed')
  },
  onRollback: () => { observed.push('onRollback') },
  afterRollback: () => { observed.push('afterRollback') },
  onRetry: () => { observed.push('onRetry') },
})

// Concurrent entries share one background batch, as a burst of queries does.
const logBatch = (queries: string[]) => Promise.all(queries.map(sql => logQuery({ query: { sql }, queryDurationMillis: 1 })))
const stored = async (queries: string[]) => (await db.selectFrom('query_logs').select('query').whereIn('query', queries).get())
  .map(row => String(row.query)).sort()

try {
  const q = (name: string) => dialect === 'mysql' ? `\`${name}\`` : `"${name}"`
  await db.unsafe(`CREATE TABLE query_logs (
    id ${dialect === 'mysql' ? 'INTEGER PRIMARY KEY AUTO_INCREMENT' : 'SERIAL PRIMARY KEY'},
    ${['query', 'normalized_query', 'connection', 'status', 'error', 'executed_at', 'bindings', 'trace', 'model', 'method', 'file'].map(column => `${q(column)} TEXT`).join(', ')},
    ${q('duration')} DOUBLE PRECISION, ${q('line')} INTEGER, ${q('memory_usage')} DOUBLE PRECISION
  )`).execute()

  const committed = ['SELECT 1 AS committed_log_a', 'SELECT 1 AS committed_log_b', 'SELECT 1 AS committed_log_c']
  await logBatch(committed)
  const committedResult = { stored: await stored(committed), observed: observed.splice(0) }

  // One statement is all-or-nothing on both servers: a rejected row leaves no
  // partial batch behind, so the per-row retry stores every other row once.
  if (dialect === 'postgres') {
    await db.unsafe(`CREATE FUNCTION reject_query_log() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        IF NEW.query = 'SELECT 1 AS rejected_log' THEN RAISE EXCEPTION 'rejected query log';
        END IF;
        RETURN NEW;
      END $$`).execute()
    await db.unsafe('CREATE TRIGGER reject_query_log BEFORE INSERT ON query_logs FOR EACH ROW EXECUTE FUNCTION reject_query_log()').execute()
  }
  else {
    await db.unsafe(`CREATE TRIGGER reject_query_log BEFORE INSERT ON query_logs FOR EACH ROW
      IF NEW.query = 'SELECT 1 AS rejected_log' THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'rejected query log';
      END IF`).execute()
  }
  const partial = ['SELECT 1 AS before_rejected_log', 'SELECT 1 AS rejected_log', 'SELECT 1 AS after_rejected_log']
  await logBatch(partial)
  const partialResult = { stored: await stored(partial), observed: observed.splice(0) }

  // An unmigrated table fails every batch. This runs last because Bun 1.4.1's
  // MySQL client keeps a statement whose prepare failed and replays that error
  // on the same connection after the table exists.
  await db.unsafe('DROP TABLE query_logs').execute()
  await logBatch(['SELECT 1 AS unmigrated_log_a', 'SELECT 1 AS unmigrated_log_b'])
  const unmigratedResult = { observed: observed.splice(0) }

  assert.deepEqual({ committed: committedResult, partial: partialResult, unmigrated: unmigratedResult }, {
    committed: { stored: committed, observed: [] },
    partial: { stored: [partial[2], partial[0]], observed: [] },
    unmigrated: { observed: [] },
  }, 'Query-log batches must store each row once and never reach application transaction observers')
  console.log('query-log-transaction-defaults-ok')
}
finally {
  config.database.queryLogging.enabled = false
  resetDatabaseConnection()
}
