import { filesystem } from '@stacksjs/storage'
import type { Model } from '@stacksjs/types'
import { projectPath } from '@stacksjs/path'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const { fs } = filesystem

function readModels(folderPath: string): Promise<Model[]> {
  return new Promise((resolve, reject) => {
    const models: Model[] = []

    fs.readdir(folderPath, (err, files) => {
      if (err)
        reject(err)

      const promises = files
        .filter(file => file.endsWith('.ts'))
        .map((file) => {
          const filePath = `${folderPath}/${file}`

          return import(filePath).then((data) => {
            models.push({
              name: data.default.name,
              fields: data.default.fields,
              useSeed: data.default.useSeed,
            })
          })
        })

      Promise.all(promises)
        .then(() => resolve(models))
        .catch(err => reject(err))
    })
  })
}

async function seed() {
  const models = await readModels(projectPath('app/models'))
  const promises = models.flatMap((model) => {
    const { useSeed, fields } = model
    const data: Record<string, any>[] = []

    if (useSeed && useSeed.count) {
      for (let i = 0; i < useSeed.count; i++) {
        const record: Record<string, any> = {}
        Object.entries(fields).forEach(([name, field]) => {
          if (field.factory)
            record[name] = field.factory()
        })
        data.push(record)
      }
    }

    return data.map(record => prisma[model.name].create({ data: record }))
  })

  return Promise.all(promises)
}

export { seed }
