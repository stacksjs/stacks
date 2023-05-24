import { storage } from '@stacksjs/storage'

const { fs } = storage

function generateFactoryFile(modelName: string, fileName: string, path: string): void {
  const generateMethodName = 'generate'
  const factoryCode = `import faker from 'faker';
  import type { SeedData } from '@stacksjs/types'

function ${generateMethodName}(): SeedData {
  return {
    // fields here
  }
}

export { ${generateMethodName} };
`

  fs.writeFileSync(`${path}/${fileName}`, factoryCode)
}

export {
  generateFactoryFile,
}
