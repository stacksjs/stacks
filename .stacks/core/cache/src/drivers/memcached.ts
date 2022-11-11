import type { Client } from 'memjs'
import { Memcached } from 'memjs'

const client: Client = Memcached.Client.create('127.0.0.1:11211')

async function set(key: string, value: any, duration: number): Promise<void> {
  await client.set(key, value, { expires: duration })
}

async function get(key: string): Promise<any> {
  const value = await client.get(key)

  return value.value.toString()
}

async function del(key: string): Promise<void> {
  await client.delete(key)
}

export { set, get, del }
