import { filesystem } from '@stacksjs/storage'
import type { Model } from '@stacksjs/types'
import { faker } from '@stacksjs/faker'

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
            // eslint-disable-next-line no-console
            console.log(data.factory)
          })
        })

      Promise.all(promises)
        .then(() => resolve(models))
        .catch(err => reject(err))
    })
  })
}

const seedData = Array.from({ length: count }).map(() => {
  const fields = Object.entries(model.fields)
  const data: Record<string, any> = {}

  fields.forEach(([name, type]) => {
    switch (type) {
      case 'string':
        data[name] = faker.lorem.words(3)
        break
      case 'number':
        // data[name] = faker.random.number()
        break
      case 'boolean':
        // data[name] = faker.random.boolean()
        break
    }
  })

  return data
})

export { readModels as seed }
