// import { storage } from '@stacksjs/storage'
import { path as p } from '@stacksjs/path'
import { log } from '@stacksjs/cli'

// import type { Model, SchemaOptions } from '@stacksjs/types'
// import { titleCase } from '@stacksjs/strings'

// const { fs } = storage

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
//   const models = await readModelsFromFolder(projectPath('app/Models'))

//   generatePrismaSchema(models, path, options)
// }

export interface MigrationOptions {
  name: string
  up: string
  down: string
}

export function generateMigrationFile(options: MigrationOptions) {
  const { name, up, down } = options

  const timestamp = new Date().getTime().toString()
  const fileName = `${timestamp}-${name}.ts`
  const filePath = p.frameworkPath(`database/migrations/${fileName}`)
  const fileContent = `
    import { Migration } from '@stacksjs/database'

    export default new Migration({
      name: '${name}',
      up: \`
        ${up}
      \`,
      down: \`
        ${down}
      \`,
    })
  `
  // TODO: use Bun.write
  fs.writeFileSync(filePath, fileContent)

  log.info(`Created migration file: ${fileName}`)
}
