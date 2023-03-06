import { filesystem } from '@stacksjs/storage'
import type { Model } from '@stacksjs/types'

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

export { readModels as seed }
