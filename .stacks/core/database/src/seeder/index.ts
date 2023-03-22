import { filesystem } from '@stacksjs/storage'
import type { Model } from '@stacksjs/types'
import { faker } from '@stacksjs/faker'
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
            })
          })
        })

      Promise.all(promises)
        .then(() => resolve(models))
        .catch(err => reject(err))
    })
  })
}

function seedData(model: Model) {
  const fields = Object.entries(model.fields)
  const data: Record<string, any> = {}

  fields.forEach(([name, type]) => {
    switch (type) {
      case 'number':
        data[name] = faker.random.numeric()
        break
      case 'boolean':
        data[name] = Math.round(Math.random())
        break
      default:
        data[name] = faker.lorem.words(3)
    }
  })

  return data
}

async function seed() {
  const models = await readModels(projectPath('app/models'))
  const promises = models.map((model) => {
    const data = seedData(model)

    return prisma[model.name].create({
      data,
    })
  })

  return Promise.all(promises)
}

export { seed }
