#!/usr/bin/env node
import cac from 'cac'
import { buildCommands, devCommands, exampleCommands, initCommands, makeCommands, testCommands, utilityCommands } from './cli/index'
import { ExitCode } from './cli/exit-code'

const artisan = cac('artisan')

// Setup global error handlers
process.on('uncaughtException', errorHandler)
process.on('unhandledRejection', errorHandler)

initCommands(artisan)
devCommands(artisan)
buildCommands(artisan)
utilityCommands(artisan)
makeCommands(artisan)
exampleCommands(artisan)
testCommands(artisan)

artisan.parse()

function errorHandler(error: Error): void {
  let message = error.message || String(error)

  if (process.env.DEBUG || process.env.NODE_ENV === 'development')
    message = error.stack || message

  console.error(message)
  process.exit(ExitCode.FatalError)
}
