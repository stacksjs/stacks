// A test file whose mock.module would leak into every later file in one process.
// Not named *.test.ts, so the package's own `bun test` never loads it.
import { expect, mock, test } from 'bun:test'

mock.module('node:os', () => ({ hostname: () => 'mocked-host' }))

test('the mock is in place here', async () => {
  const os = await import('node:os')
  expect(os.hostname()).toBe('mocked-host')
})
