process.env.APP_ENV = 'development'

await import('../../src/runtime')

const tracker = (globalThis as Record<symbol, unknown>)[Symbol.for('stacks.database.queryTracker')]
if (typeof tracker !== 'function')
  throw new Error('runtime import did not register the database query tracker')

for (let id = 1; id <= 6; id++)
  tracker(`SELECT * FROM users WHERE id = ${id}`, id, 'sqlite')

const { createErrorResponse, getQueryShapeCounts } = await import('../../src/error-handler')
const shape = 'SELECT * FROM USERS WHERE ID = ?'
if (getQueryShapeCounts().get(shape) !== 6)
  throw new Error('queries recorded before the first error were lost')

const response = await createErrorResponse(
  new Error('expected first failure'),
  new Request('http://localhost/runtime-query-tracking', { headers: { accept: 'application/json' } }),
)
const body = await response.json() as { details?: { queries?: Array<{ query?: string }> } }
if (body.details?.queries?.length !== 6)
  throw new Error('the first error did not receive its preceding query context')

await Bun.sleep(50)
console.log('runtime-query-tracking-ok')
