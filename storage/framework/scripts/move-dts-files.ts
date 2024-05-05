import process from 'node:process'
import { italic, log } from '@stacksjs/cli'
import { corePath } from '@stacksjs/path'
import { glob, storage } from '@stacksjs/storage'
import { ExitCode } from '@stacksjs/types'

log.info('Getting started to move d.ts & d.ts.map files...')

const files = await glob([
  '../dist/types/storage/framework/core/**/src/*.d.ts',
  '../dist/types/storage/framework/core/**/src/*.d.ts.map',
  '../dist/types/storage/framework/core/**/src/**/*.d.ts',
  '../dist/types/storage/framework/core/**/src/**/*.d.ts.map',
  '../dist/types/storage/framework/core/**/src/**/**/*.d.ts',
  '../dist/types/storage/framework/core/**/src/**/**/*.d.ts.map',
])

if (files.length === 0) {
  log.info('No d.ts files found')
  process.exit(ExitCode.Success)
}

for (const file of files) {
  const path = file.replace('../dist/types/storage/framework/core/', '../src/').replace('/src/', '/dist/')

  log.info('Moving', italic(file), 'to', italic(path))

  await storage.move(file, path, { overwrite: true })
}
log.success('Moved d.ts files')

log.info('Deleting dist/src folders')
await storage.del(corePath('**/dist/src'))
