import { configureDatabaseRoutingContext, contextHasWritten, markContextWrote } from '@stacksjs/database/replicas'
import { route, serverResponse } from '../../src/stacks-router'

const importStarted = Promise.withResolvers<void>()
const releaseImport = Promise.withResolvers<void>()
let importCalls = 0

configureDatabaseRoutingContext(true)

route.importRoutes = async () => {
  importCalls++
  if (importCalls === 1)
    throw new Error('expected route import failure')

  importStarted.resolve()
  await releaseImport.promise
}
route.get('/__server_response_transition', () => new Response('ok'))
const writerStarted = Promise.withResolvers<void>()
const releaseWriter = Promise.withResolvers<void>()
route.get('/__server_response_writer', async () => {
  const before = contextHasWritten()
  markContextWrote()
  const afterWrite = contextHasWritten()
  writerStarted.resolve()
  await releaseWriter.promise
  return Response.json({ before, afterWrite, afterAwait: contextHasWritten() })
})
route.get('/__server_response_reader', () => Response.json({ wrote: contextHasWritten() }))

try {
  await serverResponse(new Request('http://localhost/__server_response_transition'))
  throw new Error('failed route discovery unexpectedly served a response')
}
catch (error) {
  if (!(error instanceof Error) || error.message !== 'expected route import failure')
    throw error
}

const first = serverResponse(new Request('http://localhost/__server_response_transition'))
await importStarted.promise
const concurrent = serverResponse(new Request('http://localhost/__server_response_transition'))
releaseImport.resolve()

const [firstResponse, concurrentResponse] = await Promise.all([first, concurrent])
if (await firstResponse.text() !== 'ok' || await concurrentResponse.text() !== 'ok')
  throw new Error('concurrent requests did not serve the registered route')
if (importCalls !== 2)
  throw new Error(`expected one retry shared by concurrent requests, received ${importCalls} imports`)

route.importRoutes = async () => {
  throw new Error('route discovery ran after the loaded transition')
}
const loadedResponse = await serverResponse(new Request('http://localhost/__server_response_transition'))
if (await loadedResponse.text() !== 'ok')
  throw new Error('loaded request did not serve the registered route')

const writer = serverResponse(new Request('http://localhost/__server_response_writer'))
await writerStarted.promise
try {
  const reader = await serverResponse(new Request('http://localhost/__server_response_reader'))
  const readerState = await reader.json() as { wrote: boolean }
  if (readerState.wrote)
    throw new Error('a concurrent reader inherited the writer routing state')
}
finally {
  releaseWriter.resolve()
}

const writerState = await (await writer).json() as { before: boolean, afterWrite: boolean, afterAwait: boolean }
if (writerState.before || !writerState.afterWrite || !writerState.afterAwait)
  throw new Error(`writer routing state was not preserved: ${JSON.stringify(writerState)}`)
if (contextHasWritten())
  throw new Error('request routing state leaked outside serverResponse')

console.log('server-response-transition-ok')
