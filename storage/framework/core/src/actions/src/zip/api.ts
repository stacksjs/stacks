// TODO: we likely won't need this once we use docker images for the runtime
// zip the api for deployment
import { log } from '@stacksjs/logging'
import { path as p } from '@stacksjs/path'
import { zip } from '@stacksjs/storage'

log.info('zipping your API for Lambda usage...')

const from = [
  'bootstrap',
  'runtime.ts',
  'server.js',
]

const to = p.projectStoragePath('framework/cloud/api.zip')

// zip all the paths into a single file
await zip(from, to, {
  cwd: p.cloudPath('src/runtime'),
})

log.info('Zipped your API')