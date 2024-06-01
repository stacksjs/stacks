import process from 'node:process'
import { italic, log } from '@stacksjs/cli'
import { glob, storage } from '@stacksjs/storage'
import { ExitCode } from '@stacksjs/types'

log.info('Moving built src files to right path in the dist folder...')

const files = await glob(['../src/**/dist/src/**'])

if (files.length === 0) {
  log.info('No files to move')
  process.exit(ExitCode.Success)
}

for (const file of files) {
  const path = file.replace('dist/src', 'dist')

  log.info('Moving', italic(file), 'to', italic(path))

  await storage.move(file, path, { overwrite: true })
}

// delete empty /dist/src folder
await storage.del('../src/**/dist/src')

log.success('Moved built src files to right path in the dist folder')
