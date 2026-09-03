import process from 'node:process'
import { runCommand } from '@stacksjs/cli'
import { log } from '@stacksjs/logging'
import { path } from '@stacksjs/path'
import { ExitCode } from '@stacksjs/types'
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

if (result.isErr) {
  await log.error('There was an error compiling the binary', result.error)
  process.exit(ExitCode.FatalError)
}

// Check if the source exists (it should be, because bun compile.ts was successful)
if (await storage.exists(source)) {
  try {
    log.info('Updating Binary...')
    log.info(`Source: ${source}`) // TODO: should be debug
    log.info(`Destination: ${destination}`) // TODO: should be debug

    // `fs.ensureDir` and `fs.move` are fs-extra's, and `@stacksjs/storage`
    // re-exports node:fs - both were `undefined`, so this threw
    // "fs.ensureDir is not a function" and the catch below reported that as a
    // failed upgrade. Written with the primitives that are actually there.
    //
    // Copy-then-unlink rather than `rename`, because the build output and the
    // install destination are not necessarily on the same filesystem, and
    // `rename` fails with EXDEV across devices.
    await fs.promises.mkdir(destinationDir, { recursive: true })
    await fs.promises.copyFile(source, destination)
    await fs.promises.unlink(source)

    log.success('Binary Latest Version Is Used')
  }
  catch (err: any) {
    await log.error(err)
    process.exit(ExitCode.FatalError)
  }
}
else {
  await log.error(`Binary source not found: ${source}`)
  process.exit(ExitCode.FatalError)
}
