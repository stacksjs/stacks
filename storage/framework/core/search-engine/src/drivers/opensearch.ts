// import { searchEngine } from '@stacksjs/config'
// import type { ApiResponse } from '@opensearch-project/opensearch'
// import { Client } from '@opensearch-project/opensearch'
// import type { SearchEngineDriver } from '@stacksjs/types'
//
// const host = searchEngine.openSearch?.host
// const protocol = searchEngine.openSearch?.protocol
// const port = searchEngine.openSearch?.port
// const auth = searchEngine.openSearch?.auth
//
// const client = new Client({
//   node: `${protocol}://${auth}@${host}:${port}`,
// })
//
// async function search(index: string, params?: any) {
//   const response = await client.search({
//     index,
//     body: params.query,
//   })
//
//   return response
// }
//
// async function createIndex(indexName: string, settings?: any): Promise<ApiResponse<any, any>> {
//   return await client.indices.create({ index: indexName, body: settings })
// }
// // async function updateIndex(indexName: string,  settings?: any): Promise<ApiResponse<any, any>> {
// //   return await client.indices.update({ index: indexName, body: settings })
// // }
//
// async function deleteIndex(indexName: string): Promise<ApiResponse<any, any>> {
//   return await client.indices.delete({ index: indexName })
// }
//
// async function addDocument(indexName: string, document: any): Promise<ApiResponse<any, any>> {
//   return await client.index({
//     id: document.id,
//     index: indexName,
//     body: document,
//     refresh: true,
//   })
// }
//
// async function deleteDocument(indexName: string, document: any): Promise<ApiResponse<any, any>> {
//   return await client.delete({
//     id: document.id,
//     index: indexName,
//   })
// }
//
// export default {
//   client,
//   search,
//   createIndex,
//   deleteIndex,
//   addDocument,
//   deleteDocument,
//   // ...other methods
// } satisfies SearchEngineDriver
