// import { Cursor, MysqlDialect, PostgresDialect, createMysqlPool, createPostgresPool } from 'stacks:query-builder'
// import { database } from 'stacks:config'

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

// if (database.driver === 'sqlite') {
//   dialect = new SqliteDialect()
// }

// const db = new QueryBuilder({
//   dialect,
// })

// const user = User.find(1)

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

export const wipOrm = true
