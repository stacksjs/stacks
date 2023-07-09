// import { Cursor, MysqlDialect, PostgresDialect, createMysqlPool, createPostgresPool } from '@stacksjs/query-builder'
// import { database } from '@stacksjs/config'

// let dialect: any

// if (database.driver === 'postgres') {
//   dialect = new PostgresDialect({
//     pool: createPostgresPool({
//       host: database.host,
//       database: database.database,
//     }),
//     cursor: Cursor,
//   })
// }
// else if (database.driver === 'mysql') {
//   dialect = new MysqlDialect({
//     pool: createMysqlPool({
//       host: database.host,
//       database: database.database,
//       user: database.username,
//       password: database.password,
//     }),
//   })
// }

// const db = new QueryBuilder({
//   dialect,
// })

// export async function find(tableName: string, id: number) {
//   const result = await db
//     .selectFrom(tableName)
//     .selectAll()
//     .where('id', '=', id)
//     .execute()

//   if (result)
//     return result[0]
//   else
//     return null
// }

export {}
