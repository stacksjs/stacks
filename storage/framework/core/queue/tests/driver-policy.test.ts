import { expect, test } from 'bun:test'
import { resolveQueueDriver } from '../src/driver'

test('production queues cannot silently become inline work', () => {
  expect(resolveQueueDriver('', 'production')).toBe('database')
  expect(resolveQueueDriver('', 'test')).toBe('sync')
  expect(resolveQueueDriver('redis', 'production')).toBe('redis')
  expect(() => resolveQueueDriver('sync', 'production')).toThrow('durable')
  for (const value of ['sqs', 'memory', 'beanstalkd']) expect(() => resolveQueueDriver(value, 'development')).toThrow('not implemented')
  expect(() => resolveQueueDriver('typo', 'development')).toThrow('Unknown QUEUE_DRIVER')
})
