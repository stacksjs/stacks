import type { EnhancedRequest } from '@stacksjs/bun-router'
import process from 'node:process'
import { cacheRequestQuery, runWithRequest } from '../../src/request-context'

const unhandled: string[] = []
process.on('unhandledRejection', (error) => {
  unhandled.push(error instanceof Error ? error.message : String(error))
})

const retried = await runWithRequest(new Request('https://example.test') as EnhancedRequest, async () => {
  void cacheRequestQuery('query', () => { throw new Error('ignored query') })
  await Bun.sleep(20)
  const value = await cacheRequestQuery('query', () => 42)
  await cacheRequestQuery('handled', () => Promise.reject(new Error('handled query'))).catch(() => {})
  const failure = new Error('mixed callers')
  const handled = cacheRequestQuery('mixed', () => Promise.reject(failure))
  void cacheRequestQuery('mixed', () => Promise.reject(failure))
  await handled.catch(() => {})
  void cacheRequestQuery('ignored-first', () => Promise.reject(new Error('ignored first caller')))
  await cacheRequestQuery('ignored-first', () => 0).catch(() => {})
  await Bun.sleep(20)
  return value
})
console.log(JSON.stringify({ unhandled, retried }))
