#!/usr/bin/env node
import { runAction } from '@stacksjs/actions'
import { command, log } from '@stacksjs/cli'
import { env, frameworkVersion, isProjectCreated } from '@stacksjs/utils'
import { projectPath } from '@stacksjs/path'
import { Action } from '@stacksjs/types'
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
    if (env('APP_ENV') !== 'production') {
      log.info('Project not initialized, generating application key...')
      const result = await runAction(Action.KeyGenerate, { cwd: projectPath(), verbose: true })
      if (result.isErr()) {
        log.error(result.error)
        process.exit()
      }
      log.info('Application key generated.')
    }
    else {
      log.error('Please run `buddy key:generate` to generate an application key.')
      process.exit()
    }

    await create(cli)
  }

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

  cli.help()
  cli.version(await frameworkVersion())

  cli.parse()
}

main()

function errorHandler(error: Error): void {
  log.error(error)
  process.exit()
}
