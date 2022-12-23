#!/usr/bin/env node
import { runAction } from '@stacksjs/actions'
import { command, log } from '@stacksjs/cli'
import { isProjectCreated } from '@stacksjs/utils'
import { Action } from '@stacksjs/types'
import { version } from '../package.json'
import { build, changelog, clean, commit, create, dev, example, fresh, generate, key, lint, make, preinstall, prepublish, release, setup, test, update } from './commands'

const cli = command('stacks')

// setup global error handlers
process.on('uncaughtException', errorHandler)
process.on('unhandledRejection', errorHandler)

async function main() {
  // before running any commands, check if the project is already initialized
  await setup(cli)
  await key(cli)

  if (!await isProjectCreated()) {
    runAction(Action.KeyGenerate)

    await create(cli)
  }
  else {
    await preinstall(cli)
    await prepublish(cli)
    await update(cli)
    await generate(cli)
    await dev(cli)
    await build(cli)
    await changelog(cli)
    await clean(cli)
    await commit(cli)
    await fresh(cli)
    await lint(cli)
    await release(cli)
    await make(cli)
    await example(cli)
    await test(cli)
  }

  cli.help()
  cli.version(version)

  cli.parse()
}

main()

function errorHandler(error: Error): void {
  log.error(error)
  process.exit()
}
