import { describe, expect, it } from 'vitest'
import { createClient } from 'redis'

const client: any = createClient({
  socket: {
    host: '127.0.0.1',
    port: 6379,
  },
  password: '',
})

await client.connect()

async function set(key: any, value: any): Promise<void> {
  await client.set(key, value)
}

async function get(key: string): Promise<any> {
  const value = await client.get(key)

  return value
}

async function remove(key: string): Promise<void> {
  await client.del(key)
}

async function del(key: string): Promise<void> {
  await client.del(key)
}

async function flushAll(): Promise<void> {
  await client.sendCommand(['FLUSHALL', 'ASYNC'])
}

async function flushDB(): Promise<void> {
  await client.sendCommand(['FLUSHDB', 'ASYNC'])
}

describe('RedisTest', () => {
  it('it should set redis cache', async () => {
    await set('test', 'test')
    expect(await get('test')).toBe('test')
  })

  it('it should get redis cache', async () => {
    await set('test', 'test')
    expect(await get('test')).toBe('test')
  })

  it('it should remove cache', async () => {
    await set('test', 'test')
    await remove('test')
    expect(await get('test')).toBe(null)
  })

  it('it should del cache', async () => {
    await set('test', 'test')
    await del('test')
    expect(await get('test')).toBe(null)
  })

  it('it should flush all cache', async () => {
    await set('test', 'test')
    await flushAll()
    expect(await get('test')).toBe(null)
  })

  it('it should flush all DB', async () => {
    await set('test', 'test')
    await flushDB()
    expect(await get('test')).toBe(null)
  })
})

