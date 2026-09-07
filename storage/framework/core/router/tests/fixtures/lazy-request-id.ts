const nativeRandomUuid = crypto.randomUUID.bind(crypto)
let randomUuidCalls = 0

crypto.randomUUID = (() => {
  randomUuidCalls++
  return nativeRandomUuid()
}) as typeof crypto.randomUUID

const { createStacksRouter } = await import('../../src/stacks-router')

if (randomUuidCalls !== 0)
  throw new Error(`Router import initialized request IDs ${randomUuidCalls} time(s)`)

const withoutIds = createStacksRouter({
  autoDiscoverRoutes: false,
  csrf: false,
  requestIds: false,
})
withoutIds.get('/without-ids', () => ({ ok: true }))
await withoutIds.handleRequest(new Request('http://localhost/without-ids'))

if (randomUuidCalls !== 0)
  throw new Error(`ID-disabled request initialized request IDs ${randomUuidCalls} time(s)`)

const withIds = createStacksRouter({
  autoDiscoverRoutes: false,
  csrf: false,
})
withIds.get('/with-ids', () => ({ ok: true }))
await withIds.handleRequest(new Request('http://localhost/with-ids'))

if (randomUuidCalls !== 1)
  throw new Error(`First generated request ID initialized its prefix ${randomUuidCalls} time(s)`)

console.log('lazy-request-id-ok')
