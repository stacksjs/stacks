import { createClient } from 'redis'
import { cache } from '@stacksjs/config'

const client: any = createClient({
  socket: {
    host: cache.redis.host,
    port: cache.redis.port,
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

export { set, get, remove, del, flushAll, flushDB, client }
