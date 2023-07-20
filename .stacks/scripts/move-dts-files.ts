import { glob } from '@stacksjs/utils'
import { log } from '@stacksjs/logging'
import { italic } from '@stacksjs/cli'
import { storage } from '@stacksjs/storage'
import { ExitCode } from '@stacksjs/types'

log.info('Getting started to move d.ts & d.ts.map files...')

const files = await glob([
  '../dist/types/.stacks/core/**/src/*.d.ts',
  '../dist/types/.stacks/core/**/src/*.d.ts.map',
  '../dist/types/.stacks/core/**/src/**/*.d.ts',
  '../dist/types/.stacks/core/**/src/**/*.d.ts.map',
  '../dist/types/.stacks/core/**/src/**/**/*.d.ts',
  '../dist/types/.stacks/core/**/src/**/**/*.d.ts.map',
])

if (files.length === 0) {
  log.info('No d.ts files found')
  process.exit(ExitCode.FatalError)
}

for (const file of files) {
  const path = file
    .replace('../dist/types/.stacks/core/', '../core/')
    .replace('/src/', '/dist/')

  log.info('Moving', italic(file), 'to', italic(path))

  await storage.move(file, path, { overwrite: true })
}

log.success('Moved d.ts files')
