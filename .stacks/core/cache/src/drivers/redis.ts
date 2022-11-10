import { createClient } from 'redis';
import { cache } from '../../config/src/index'


const client: any = createClient({
  host: `${cache.host}:${cache.port}`,
  password: '',
});

await client.connect();

async function set(key: any, value: any): Promise<void> {
  await client.set(key, value);

  await client.disconnect();
}

async function get(key: string): Promise<any> {
  const value = await client.get(key);

  await client.disconnect();
  return value;
}

async function remove(key: string): Promise<void> {
  await client.del(key)
  await client.disconnect();
}

async function del(key: string): Promise<void> {
  await client.del(key)
  await client.disconnect();
}

async function flushAll(): Promise<void> {
  await client.sendCommand(['FLUSHALL', 'ASYNC']);

  await client.disconnect();
}

async function flushDB(): Promise<void> {
  await client.sendCommand(['FLUSHDB', 'ASYNC']);

  await client.disconnect();
}

export { set, get, remove, del, flushAll, flushDB }
