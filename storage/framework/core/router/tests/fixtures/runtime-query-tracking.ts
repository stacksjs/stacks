// Runs the same N+1-shaped loop either inside a request scope (`request`) or
// with no request at all, the way a CLI command or queue worker does (`cli`).
process.env.APP_ENV = 'development'

const mode = process.argv[2] ?? 'cli'
if (mode !== 'cli' && mode !== 'request')
  throw new Error(`unknown mode: ${mode}`)

await import('../../src/runtime')

const tracker = (globalThis as Record<symbol, unknown>)[Symbol.for('stacks.database.queryTracker')]
if (typeof tracker !== 'function')
  throw new Error('runtime import did not register the database query tracker')

const { runWithRequest } = await import('../../src/request-context')
const request = new Request('http://localhost/runtime-query-tracking', { headers: { accept: 'application/json' } })

async function run(): Promise<void> {
  for (let id = 1; id <= 6; id++)
    tracker(`SELECT * FROM users WHERE id = ${id}`, id, 'sqlite')

  const { createErrorResponse, getQueryShapeCounts } = await import('../../src/error-handler')
  const shape = 'SELECT * FROM USERS WHERE ID = ?'
  const expectedShapeCount = mode === 'request' ? 6 : undefined
  if (getQueryShapeCounts().get(shape) !== expectedShapeCount)
    throw new Error(`expected shape count ${expectedShapeCount}, got ${getQueryShapeCounts().get(shape)}`)

  const response = await createErrorResponse(new Error('expected first failure'), request)
  const body = await response.json() as { details?: { queries?: Array<{ query?: string }> } }
  if (body.details?.queries?.length !== 6)
    throw new Error('the first error did not receive its preceding query context')
}

if (mode === 'request')
  await runWithRequest(request as any, run)
else
  await run()

await Bun.sleep(50)
console.log('runtime-query-tracking-ok')
