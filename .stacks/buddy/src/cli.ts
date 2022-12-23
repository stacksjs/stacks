#!/usr/bin/env node
import { runAction } from '@stacksjs/actions'
import { command, log } from '@stacksjs/cli'
import { env, isProjectCreated } from '@stacksjs/utils'
import { Action } from '@stacksjs/types'
import { version } from '../package.json'
import { build, changelog, clean, commit, create, dev, example, fresh, generate, key, lint, make, preinstall, prepublish, release, setup, test, update } from './commands'

const cli = command('stacks')

// setup global error handlers
process.on('uncaughtException', errorHandler)
process.on('unhandledRejection', errorHandler)

async function main() {
  // the following commands are not dependent on the project being initialized
  await setup(cli)
  await key(cli)

  // before running any commands, check if the project is already initialized
  if (!await isProjectCreated()) {
    console.log('here?')
    if (env('APP_ENV') !== 'production') {
      console.log('here2?')
      await runAction(Action.KeyGenerate, { cwd: projectPath(), debug: true })
    }
    else { log.info('Please run `buddy key:generate` to generate an application key.') }

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
