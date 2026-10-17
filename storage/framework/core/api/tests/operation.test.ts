import { expect, test } from 'bun:test'
import { defineApiOperation } from '../src/operation'

test('every transport invocation authorizes before it can run the operation', async () => {
  let writes = 0
  const operation = defineApiOperation({
    authorize: (context: { allowed: boolean }) => { if (!context.allowed) throw new Error('Forbidden') },
    handle: () => ++writes,
  })
  await expect(operation.execute({ allowed: false })).rejects.toThrow('Forbidden')
  expect(writes).toBe(0)
  expect(await operation.execute({ allowed: true })).toBe(1)
  await expect(operation.execute({ allowed: false })).rejects.toThrow('Forbidden')
  expect(writes).toBe(1)
})

// Mutating a registration object must not disable a registered authorization boundary.
test('captures operation policy at registration', async () => {
  const options = { authorize() { throw new Error('Forbidden') }, handle() { return 1 } }
  const operation = defineApiOperation(options)
  options.authorize = () => {}
  await expect(operation.execute(undefined)).rejects.toThrow('Forbidden')
})
