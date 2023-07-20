import { glob } from '@stacksjs/utils'
import { path } from '@stacksjs/path'
import { italic } from '@stacksjs/cli'
import { storage } from '@stacksjs/storage'

console.log('Moving d.ts files', path.resolve(__dirname, '..'))

const files = await glob([
  '../dist/types/.stacks/core/**/src/*.d.ts',
  '../dist/types/.stacks/core/**/src/*.d.ts.map',
  '../dist/types/.stacks/core/**/src/**/*.d.ts',
  '../dist/types/.stacks/core/**/src/**/*.d.ts.map',
  '../dist/types/.stacks/core/**/src/**/**/*.d.ts',
  '../dist/types/.stacks/core/**/src/**/**/*.d.ts.map',
])

for (const file of files) {
  const path = file.replace('../dist/types/.stacks/core/', '../core/').replace('/src/', '/dist/')
  console.log('Moving', italic(file), 'to', italic(path))
  await storage.move(file, path)
}
