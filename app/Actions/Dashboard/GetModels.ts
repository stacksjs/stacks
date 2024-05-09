import { Action } from '@stacksjs/actions'
import { path } from '@stacksjs/path'
import type { Model } from '@stacksjs/types'
import { Glob } from 'bun'

export default new Action({
  name: 'GetModels',
  description: 'Gets the application models.',
  apiResponse: true,

  async handle() {
    const glob = new Glob('**/*.ts')
    const scanOptions = { cwd: path.userModelsPath(), onlyFiles: true }
    const displayModels: Model[] = []

    for await (const file of glob.scan(scanOptions)) {
      const model = (await import(path.userModelsPath(file))).default as Model
      if (model.dashboard?.highlight !== undefined && model.dashboard?.highlight !== false) displayModels.push(model)
    }

    if (!displayModels.length) {
      // If no models should be highlighted, we can just return up to 8 models in alphabetical order
      for await (const file of glob.scan(scanOptions)) {
        const model = (await import(path.userModelsPath(file))).default as Model
        displayModels.push(model)
      }
    }

    if (displayModels.length > 8) displayModels.length = 8
    displayModels.sort((a, b) => (a.name || '').localeCompare(b.name || ''))

    console.log(displayModels.map((model) => model.name))
  },
})
