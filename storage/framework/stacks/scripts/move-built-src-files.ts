import process from 'node:process'
import { italic, log } from 'src/cli/src'
import { glob, storage } from 'src/storage/src'
import { ExitCode } from 'src/types/src'

log.info('Moving built src files to right path in the dist folder...')

const files = await glob([
  '../core/**/dist/src/**',
])

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
await storage.del('../core/**/dist/src')

log.success('Moved built src files to right path in the dist folder')
