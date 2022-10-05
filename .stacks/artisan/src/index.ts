#!/usr/bin/env node
import cac from 'cac'
import { isInitialized } from '../../core'
import { version } from '../../../package.json'
import { buildCommands, devCommands, exampleCommands, generateCommands, initCommands, keyCommands, makeCommands, testCommands, updateCommands, utilityCommands } from './cli'
import { ExitCode } from './cli/exit-code'

const artisan = cac('artisan')

// setup global error handlers
process.on('uncaughtException', errorHandler)
process.on('unhandledRejection', errorHandler)

async function main() {
  // before running any commands, check if the project is already initialized
  await keyCommands(artisan)

  if (!await isInitialized(process.cwd())) {
    await initCommands(artisan)
  }
  else {
    await updateCommands(artisan)
    await generateCommands(artisan)
    await devCommands(artisan)
    await buildCommands(artisan)
    await utilityCommands(artisan)
    await makeCommands(artisan)
    await exampleCommands(artisan)
    await testCommands(artisan)
  }

  artisan.help()
  artisan.version(version)

  artisan.parse()
}

main()

function errorHandler(error: Error): void {
  let message = error.message || String(error)

  if (process.env.DEBUG || process.env.NODE_ENV === 'development')
    message = error.stack || message

  console.error(message)
  process.exit(ExitCode.FatalError)
}
