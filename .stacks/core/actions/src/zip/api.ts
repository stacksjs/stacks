// zip the api for deployment
import { zip } from '@stacksjs/storage'
import { path as p } from '@stacksjs/path'

console.log('Zipping your API for Lambda usage...')

const from = [
  p.cloudPath('src/drivers/aws/runtime/bootstrap'),
  p.cloudPath('src/drivers/aws/runtime/runtime.ts'),
  p.cloudPath('src/drivers/aws/runtime/hello.ts'),
]

const to = p.projectStoragePath('framework/cloud/lambda.zip')

// zip all the paths into a single file
await zip(from, to, {
  cwd: p.cloudPath('src/drivers/aws/runtime'),
})

console.log('Zipped your API')
