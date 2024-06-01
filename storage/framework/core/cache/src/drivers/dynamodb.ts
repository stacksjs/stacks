export type {}

// import type { PutItemCommandInput } from '@aws-sdk/client-dynamodb'
// import { DynamoDB, ListTablesCommand } from '@aws-sdk/client-dynamodb'
// import { cache } from '@stacksjs/config'

// const valueAttribute = 'value'
// const keyAttribute = 'key'

// const tableName = cache.dynamodb.table

// const dynamodb = new DynamoDB({ region: cache.dynamodb.region })

// async function createTable() {
//   const tables = await dynamodb.send(new ListTablesCommand({}))

//   const tableExists = tables.TableNames?.includes('cache')

//   if (tableExists)
//     return

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
//     TableName: tableName,
//   }

//   await dynamodb.createTable(params)
// }

// async function set(key: string, value: string | number): Promise<void> {
//   const params: PutItemCommandInput = {
//     TableName: tableName,
//     Item: {
//       [keyAttribute]: {
//         S: key,
//       },
//       [valueAttribute]: {
//         [getValueType(value)]: serialize(value),
//       },
//     },
//   }

//   await dynamodb.putItem(params)
// }

// async function get(key: string): Promise<string | undefined | null> {
//   const params = {
//     TableName: tableName,
//     Key: {
//       [keyAttribute]: {
//         S: key,
//       },
//     },
//   }

//   const response = await dynamodb.getItem(params)

//   if (!response.Item)
//     return null

//   return response.Item[valueAttribute].S ?? response.Item[valueAttribute].N
// }

// function getValueType(value: string | number) {
//   if (typeof value === 'string')
//     return 'S'

//   if (typeof value === 'number')
//     return 'N'

//   return 'S'
// }

// async function remove(key: string): Promise<void> {
//   const params = {
//     TableName: tableName,
//     Key: {
//       [keyAttribute]: {
//         S: key,
//       },
//     },
//   }

//   await dynamodb.deleteItem(params)
// }

// async function del(key: string): Promise<void> {
//   const params = {
//     TableName: tableName,
//     Key: {
//       [keyAttribute]: {
//         S: key,
//       },
//     },
//   }

//   await dynamodb.deleteItem(params)
// }

// function serialize(value: string | number) {
//   return String(value)
// }

// export { set, get, remove, del, createTable }
