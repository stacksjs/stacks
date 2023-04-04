// import { filesystem } from '@stacksjs/storage'
// import { frameworkPath, projectPath } from '@stacksjs/path'
// import type { Model, SchemaOptions } from '@stacksjs/types'
// import { titleCase } from '@stacksjs/strings'

// const { fs } = filesystem

// function generatePrismaSchema(models: Model[], path: string, options: SchemaOptions): void {
//   let schema = `datasource db {
//   provider = "${options.database}"
//   url = env("DATABASE_URL")
// }

// generator client {
//   provider = "prisma-client-js"
// }

// `

//   for (const model of models) {
//     schema += `model ${model.name} {
//   id       Int      @id @default(autoincrement())
// `

//     for (const fieldName in model.fields) {
//       const field = model.fields[fieldName]

//       let columnSchema = `  ${fieldName} ${field.type}`

//       if (field.required)
//         columnSchema += ' @required'

//       if (field.unique)
//         columnSchema += ' @unique'

//       if (field.default)
//         columnSchema += ` @default(${field.default})`

//       columnSchema += '\n'
//       schema += columnSchema
//     }

//     if (model.hasOne) {
//       schema += `  ${model.hasOne} ${titleCase(model.hasOne)}?`
//       schema += ` @relation(fields: [${model.hasOne}Id], references: [id])\n`
//       schema += `  ${model.hasOne}Id Int\n`
//     }

//     if (model.belongsToMany) {
//       schema += `  ${model.belongsToMany} ${titleCase(model.belongsToMany)}`
//       schema += ` @relation(fields: [${model.belongsToMany}Id], references: [id])\n`
//       schema += `  ${model.belongsToMany}Id Int\n`
//     }

//     if (model.hasMany) {
//       schema += `  ${model.hasMany} ${titleCase(model.hasMany)}[]`
//       schema += ` @relation(fields: [id], references: [${model.name?.toLowerCase()}Id])\n`
//     }

//     if (model.hasThrough) {
//       schema += `  ${model.hasThrough.model} ${titleCase(model.hasThrough.model)}[]`
//       schema += ` @relation("${model.hasThrough.using}")`
//       schema += ` ${model.hasThrough.using} ${titleCase(model.hasThrough.using)}`
//       schema += ` @relation("${model.hasThrough.through}")`
//       schema += ` ${model.hasThrough.through} ${titleCase(model.hasThrough.through)}`
//       schema += ` @relation(fields: [${model.hasThrough.using}], references: [id])\n`
//     }

//     schema += '  createdAt DateTime @default(now())\n'
//     schema += '  updatedAt DateTime @updatedAt()\n'
//     schema += '}\n\n'

//     if (model.hasMany) {
//       schema += `model ${titleCase(model.hasMany)} {
// id       Int      @id @default(autoincrement())
// createdAt DateTime @default(now())
// updatedAt DateTime @updatedAt()
// ${model.name?.toLowerCase()}Id Int
// ${model.name?.toLowerCase()} ${titleCase(model.name)}
// @relation(fields: [${model.name?.toLowerCase()}Id], references: [id])
// }\n\n`
//     }

//     if (model.hasOne || model.belongsToMany) {
//       const relatedModelName = model.hasOne || model.belongsToMany
//       schema += `model ${titleCase(relatedModelName)} {
// id       Int      @id @default(autoincrement())
// createdAt DateTime @default(now())
// updatedAt DateTime @updatedAt()
// ${model.name?.toLowerCase()} ${titleCase(model.name)}?
// ${model.name?.toLowerCase()}Id Int?
// @unique
// }\n\n`
//     }
//   }

//   if (!fs.existsSync(frameworkPath('database')))
//     fs.mkdirSync(frameworkPath('database'))

//   fs.writeFile(path, schema, (err) => {
//     if (err)
//       console.error(`Error writing schema file: ${err.message}`)
//     else
//       // eslint-disable-next-line no-console
//       console.log(`Schema file generated successfully at path: ${path}`)
//   })
// }

// function readModelsFromFolder(folderPath: string): Promise<Model[]> {
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
//             })
//           })
//         })

//       Promise.all(promises)
//         .then(() => resolve(models))
//         .catch(err => reject(err))
//     })
//   })
// }

// async function migrate(path: string, options: SchemaOptions): Promise<void> {
//   const models = await readModelsFromFolder(projectPath('app/models'))

//   generatePrismaSchema(models, path, options)
// }

// export {
//   migrate,
// }

export {}
