// import { DynamoDB, ListTablesCommand } from '@aws-sdk/client-dynamodb'
// import { expect, it } from '@stacksjs/testing'
//
// const dynamodb = new DynamoDB({ region: 'us-east-1' })
//
// describe('dynamoDB test', () => {
//   it('it should create a table for dynamodb cache', async () => {
//     await createTable()
//   })
//
//   it('it should set dynamodb cache', async () => {
//     await set('foo', 'bar')
//     const value = await get('foo')
//     expect(value).toBe('bar')
//   })
//
//   it('it should get dynamodb cache', async () => {
//     await set('foo', 'bar')
//     const value = await get('foo')
//     expect(value).toBe('bar')
//   })
//
//   it('it should delete dynamodb cache', async () => {
//     await set('foo', 'bar')
//     await remove('foo')
//     const value = await get('foo')
//     expect(value).toBe(null)
//   })
// })
//
// async function createTable() {
//   const tables = await dynamodb.send(new ListTablesCommand({}))
//
//   const tableExists = tables.TableNames?.includes('cache')
//
//   if (tableExists)
//     return
//
//   const params = {
//     AttributeDefinitions: [
//       {
//         AttributeName: 'key',
//         AttributeType: 'S',
//       },
//     ],
//     KeySchema: [
//       {
//         AttributeName: 'key',
//         KeyType: 'HASH',
//       },
//     ],
//     ProvisionedThroughput: {
//       ReadCapacityUnits: 5,
//       WriteCapacityUnits: 5,
//     },
//     TableName: 'cache',
//   }
//
//   await dynamodb.createTable(params)
// }
//
// // TODO: needs to be imported to cache package
// async function set(key: string, value: string | number): Promise<void> {
//   console.log('set', key, value)
//   return Promise.resolve()
//   // const valueAttribute = 'value'
//   // const keyAttribute = 'key'
//   //
//   // const params: PutItemCommandInput = {
//   //   TableName: 'cache',
//   //   Item: {
//   //     [keyAttribute]: {
//   //       S: key,
//   //     },
//   //     [valueAttribute]: {
//   //       [getValueType(value)]: serialize(value),
//   //     },
//   //   },
//   // }
//   //
//   // await dynamodb.putItem(params)
// }
//
// // TODO: needs to be imported to cache package
// async function get(key: string): Promise<string | undefined | null> {
//   const valueAttribute = 'value'
//   const keyAttribute = 'key'
//
//   const params = {
//     TableName: 'cache',
//     Key: {
//       [keyAttribute]: {
//         S: key,
//       },
//     },
//   }
//
//   const response = await dynamodb.getItem(params)
//
//   if (!response.Item)
//     return null
//
//   return response.Item[valueAttribute].S ?? response.Item[valueAttribute].N
// }
//
// // TODO: needs to be imported to cache package
// async function remove(key: string): Promise<void> {
//   const keyAttribute = 'key'
//
//   const params = {
//     TableName: 'cache',
//     Key: {
//       [keyAttribute]: {
//         S: key,
//       },
//     },
//   }
//
//   await dynamodb.deleteItem(params)
// }
//
// // TODO: needs to be imported to cache package
// // async function del(key: string): Promise<void> {
// //   const params = {
// //     TableName: 'cache',
// //     Key: {
// //       [keyAttribute]: {
// //         S: key,
// //       },
// //     },
// //   }
//
// //   await dynamodb.deleteItem(params)
// // }
