#!/usr/bin/env node
import cac from 'cac'
import { version } from '../../../package.json'
import { isInitialized } from '../../core/helpers'
import { build, dev, example, generate, init, key, make, test, update, utility } from './commands'
import { ExitCode } from './commands/exit-code'

const artisan = cac('artisan')

// setup global error handlers
process.on('uncaughtException', errorHandler)
process.on('unhandledRejection', errorHandler)

async function main() {
  // before running any commands, check if the project is already initialized
  await key(artisan)

  if (!await isInitialized()) {
    await init(artisan)
  }
  else {
    await update(artisan)
    await generate(artisan)
    await dev(artisan)
    await build(artisan)
    await utility(artisan)
    await make(artisan)
    await example(artisan)
    await test(artisan)
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
