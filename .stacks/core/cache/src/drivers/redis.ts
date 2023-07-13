import type { RedisClientType } from 'redis'
import { createClient } from 'redis'
import { cache } from '@stacksjs/config'

export const client: RedisClientType = createClient({
  socket: {
    host: cache.drivers?.redis?.host,
    port: cache.drivers?.redis?.port,
  },
  password: '',
})

// await client.connect()
// client.on('error', (error) => {
//   console.error(error)
// })

export async function set(key: string, value: any): Promise<void> {
  await client.set(key, value)
}

export async function get(key: string): Promise<any> {
  const value = await client.get(key)

  return value
}

export async function remove(key: string): Promise<void> {
  await client.del(key)
}

export async function del(key: string): Promise<void> {
  await client.del(key)
}

export async function flushAll(): Promise<void> {
  await client.sendCommand(['FLUSHALL', 'ASYNC'])
}

export async function flushDB(): Promise<void> {
  await client.sendCommand(['FLUSHDB', 'ASYNC'])
}
