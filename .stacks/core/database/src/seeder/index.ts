// import { Kysely, MysqlDialect, sql } from 'kysely'
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

// async function seed() {
//   const db = new Kysely({
//     dialect: new MysqlDialect({
//       pool: {
//         connection: {
//           host: config.host,
//           port: config.port,
//         },
//       },
//     }),
//   })

//   const models = await readModels(projectPath('app/models'))

//   const queries = models.flatMap((model) => {
//     const { useSeed, fields } = model

//     if (!useSeed || !useSeed.count)
//       return []

//     const records: Record<string, any>[] = []
//     for (let i = 0; i < useSeed.count; i++) {
//       const record: Record<string, any> = {}
//       Object.entries(fields).forEach(([name, field]) => {
//         if (field.factory)
//           record[name] = field.factory()
//       })
//       records.push(record)
//     }

//     return db.insertInto(model.name).values(records).build(sql`RETURNING *`)
//   })

//   const { rows } = await db.transaction(queries).execute()

//   return rows
// }

// export { seed }

export {}
