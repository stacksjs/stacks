// zip the api for deployment
import { zip } from '@stacksjs/storage'
import { path as p } from '@stacksjs/path'

console.log('✓ zipping your API for Lambda usage...')

const from = [
  'bootstrap',
  'runtime.ts',
  'dist/server.js',
]

const to = p.projectStoragePath('framework/cloud/lambda.zip')

// zip all the paths into a single file
await zip(from, to, {
  cwd: p.cloudPath('src/drivers/aws/runtime'),
})

console.log('✓ zipped your API')
