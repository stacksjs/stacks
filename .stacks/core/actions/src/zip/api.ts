// zip the api for deployment
import { zip } from '@stacksjs/storage'
import { path as p } from '@stacksjs/path'

const paths = [
  p.cloudPath('src/drivers/aws/runtime/bootstrap'),
  p.cloudPath('src/drivers/aws/runtime/runtime.ts'),
  p.cloudPath('src/drivers/aws/runtime/hello.ts'),
]

console.log('Zipping your API for Lambda usage...')

// zip all the paths into a single file
await zip(paths, { level: 9, output: p.projectStoragePath('framework/api/lambda.zip') })

console.log('Zipped your API')
