import process from 'node:process'
import { runCommand } from '@stacksjs/cli'
import { log } from '@stacksjs/logging'
import { path } from '@stacksjs/path'
import { fs, storage } from '@stacksjs/storage'

/**
 * Move the `stacks` binary to the user's home directory.
 */

const source = path.buddyPath('dist/stacks')
const destination = path.homeDir('.stacks/bin/stacks')
const destinationDir = path.homeDir('.stacks/bin/')

log.info('Upgrading `stacks`...')

// ensure the latest binary is generated
const result = await runCommand('bun compile.ts', { cwd: path.buddyPath() })

if (result.isErr()) {
  log.error('There was an error compiling the binary', result.error)
  process.exit()
}

// Check if the source exists (it should be, because bun compile.ts was successful)
if (await storage.exists(source)) {
  try {
    log.info('Updating Binary...')
    log.info(`Source: ${source}`) // TODO: should be debug
    log.info(`Destination: ${destination}`) // TODO: should be debug

    await fs.ensureDir(destinationDir) // Ensure the destination directory exists
    await fs.move(source, destination, { overwrite: true })

    log.success('Binary Latest Version Is Used')
  }
  catch (err: any) {
    log.error(err)
  }
}
else {
  log.error(`Binary source not found: ${source}`)
}
