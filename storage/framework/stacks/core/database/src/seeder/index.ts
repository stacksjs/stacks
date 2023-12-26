// import { MysqlDialect, QueryBuilder, createPool } from '@stacksjs/query-builder'
// import { filesystem } from '@stacksjs/storage'
// import type { Model } from '@stacksjs/types'
// import { projectPath } from '@stacksjs/path'
// import { database as config } from '@stacksjs/config'

// const { fs } = filesystem

// function readModels(folderPath: string): Promise<Model[]> {
//   return new Promise((resolve, reject) => {
//     const models: Model[] = []

//     fs.readdir(folderPath, (err, files) => {
//       if (err)
//         reject(err)

//       const promises = files
//         .filter(file => file.endsWith('.ts'))
//         .map((file) => {
//           const filePath = `${folderPath}/${file}`

//           return import(filePath).then((data) => {
//             models.push({
//               name: data.default.name,
//               fields: data.default.fields,
//               useSeed: data.default.useSeed,
//             })
//           })
//         })

//       Promise.all(promises)
//         .then(() => resolve(models))
//         .catch(err => reject(err))
//     })
//   })
// }

async function seed() {
  // const db = new QueryBuilder({
  //   dialect: new MysqlDialect({
  //     pool: createPool({
  //       database: config.database,
  //       host: config.host,
  //       password: config.password,
  //       user: config.username,
  //     }),
  //   }),
  // })

  // const models = await readModels(projectPath('app/Models'))

  // const queries = models.flatMap((model) => {
  //   const { seedable, fields } = model

  //   if (!seedable)
  //     return []

  //   const count = typeof seedable === 'boolean' ? 10 : seedable.count

  //   const records: Record<string, any>[] = []
  //   for (let i = 0; i < count; i++) {
  //     const record: Record<string, any> = {}
  //     Object.entries(fields).forEach(([name, field]) => {
  //       if (field.factory)
  //         record[name] = field.factory()
  //     })
  //     records.push(record)
  //   }

  //     return model
  //   // return db.insertInto('users').values(records).build(sql`RETURNING *`)
  // })

  // const { rows } = await db.transaction().execute()

  // return rows
}

export { seed }
