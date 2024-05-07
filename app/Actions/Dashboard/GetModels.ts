import { Action } from '@stacksjs/actions'
import { Glob } from 'bun'

export default new Action({
  name: 'GetModels',
  description: 'Gets the application models.',
  apiResponse: true,

  async handle() {
    const glob = new Glob('**/*.ts')

    // Scans the current working directory and each of its sub-directories recursively
    for await (const file of glob.scan({
      cwd: '.',
      onlyFiles: true,
    })) {
      console.log(file) // => "index.ts"
    }

    // return Library.downloadCount()
  },
})
