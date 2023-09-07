// zip the api for deployment
import { zip } from '@stacksjs/storage'
import { path as p } from '@stacksjs/path'

console.log('Zipping your API for Lambda usage...')

const paths = [
  'bootstrap',
  'runtime.ts',
  'hello.ts',
]

// zip all the paths into a single file
await zip(paths, p.projectStoragePath('framework/api/lambda.zip'), {
  cwd: p.cloudPath('src/drivers/aws/runtime')
})

console.log('Zipped your API')
