// import { expect, it } from '@stacksjs/testing'
//
// import { createClient } from 'redis'
//
// // TODO: needs to be imported from cache package
//
// const client: any = createClient({
//   socket: {
//     host: '127.0.0.1',
//     port: 6379,
//   },
//   password: '',
// })
//
// // TODO: needs to be moved to cache package
// await client.connect()
//
// // TODO: needs to be imported to cache package
// async function set(key: any, value: any): Promise<void> {
//   await client.set(key, value)
// }
//
// // TODO: needs to be imported to cache package
// async function get(key: string): Promise<any> {
//   const value = await client.get(key)
//
//   return value
// }
//
// // TODO: needs to be imported to cache package
// async function remove(key: string): Promise<void> {
//   await client.del(key)
// }
//
// // TODO: needs to be imported to cache package
// async function del(key: string): Promise<void> {
//   await client.del(key)
// }
//
// // TODO: needs to be imported to cache package
// async function flushAll(): Promise<void> {
//   await client.sendCommand(['FLUSHALL', 'ASYNC'])
// }
//
// // TODO: needs to be imported to cache package
// async function flushDB(): Promise<void> {
//   await client.sendCommand(['FLUSHDB', 'ASYNC'])
// }
//
// describe('redisTest', () => {
//   it('it should set redis cache', async () => {
//     await set('test', 'test')
//     expect(await get('test')).toBe('test')
//   })
//
//   it('it should get redis cache', async () => {
//     await set('test', 'test')
//     expect(await get('test')).toBe('test')
//   })
//
//   it('it should remove cache', async () => {
//     await set('test', 'test')
//     await remove('test')
//     expect(await get('test')).toBe(null)
//   })
//
//   it('it should del cache', async () => {
//     await set('test', 'test')
//     await del('test')
//     expect(await get('test')).toBe(null)
//   })
//
//   it('it should flush all cache', async () => {
//     await set('test', 'test')
//     await flushAll()
//     expect(await get('test')).toBe(null)
//   })
//
//   it('it should flush all DB', async () => {
//     await set('test', 'test')
//     await flushDB()
//     expect(await get('test')).toBe(null)
//   })
// })
