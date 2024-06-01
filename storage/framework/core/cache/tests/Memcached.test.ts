// import { expect, it } from '@stacksjs/testing'
// import Memcached, { type Client } from 'memjs'
//
// const client: Client = Memcached.Client.create('127.0.0.1:11211')
//
// // TODO: needs to be imported to cache package
// async function set(key: string, value: any, duration: number): Promise<void> {
//   await client.set(key, value, { expires: duration })
// }
//
// // TODO: needs to be imported to cache package
// async function get(key: string): Promise<any> {
//   const value = await client.get(key)
//
//   const result = value.value ? value.value.toString() : null
//
//   return result
// }
//
// async function del(key: string): Promise<void> {
//   await client.delete(key)
// }
//
// // TODO: needs to be imported to cache package
// async function flush(): Promise<void> {
//   await client.flush()
// }
//
// describe('memcachedTest', () => {
//   it('it should set memcached cache', async () => {
//     await set('test', 'test', 10 * 60)
//     expect(await get('test')).toBe('test')
//   })
//
//   it('it should get memcached cache', async () => {
//     await set('test', 'test', 10 * 60)
//     expect(await get('test')).toBe('test')
//   })
//
//   it('it should delete memcached cache', async () => {
//     await set('test', 'test', 10 * 60)
//     await del('test')
//     expect(await get('test')).toBe(null)
//   })
//
//   it('it should flush memcached cache', async () => {
//     await set('test', 'test', 10 * 60)
//     await flush()
//     expect(await get('test')).toBe(null)
//   })
// })
