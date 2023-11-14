import { cache } from '@stacksjs/config'
import Redis, { Command } from 'ioredis'

export const client = new Redis({
  host: cache.drivers?.redis?.host,
  port: cache.drivers?.redis?.port,
  username: cache.drivers?.redis?.username,
  password: cache.drivers?.redis?.password,
})

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
  const command = new Command('FLUSHALL', ['ASYNC'], { replyEncoding: 'utf-8' }, () => {})
  await client.sendCommand(command);
}

export async function flushDB(): Promise<void> {
  const command = new Command('FLUSHDB', ['ASYNC'], { replyEncoding: 'utf-8' }, () => {})
  await client.sendCommand(command)
}
