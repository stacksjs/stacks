#!/usr/bin/env node
import { runAction } from '@stacksjs/actions'
import { errorHandler } from '@stacksjs/error-handling'
import { command, log } from '@stacksjs/cli'
import { env, frameworkVersion, installIfVersionMismatch, isProjectCreated } from '@stacksjs/utils'
import { projectPath } from '@stacksjs/path'
import { Action } from '@stacksjs/types'
import { build, changelog, clean, commit, create, dev, example, fresh, generate, key, lint, make, migrate, preinstall, prepublish, release, seed, setup, test, upgrade, version } from './commands'

const cli = command('buddy')

// setup global error handlers
process.on('uncaughtException', errorHandler)
process.on('unhandledRejection', errorHandler)

async function main() {
  // the following commands are not dependent on the project being initialized
  await installIfVersionMismatch()
  await setup(cli)
  await key(cli)

  // before running any commands, check if the project is already initialized
  if (!await isProjectCreated()) {
    if (env('APP_ENV') !== 'production')
      log.info('Project not yet initialized, generating application key...')
    else
      errorHandler('Please run `buddy key:generate` to generate an application key')

    const result = await runAction(Action.KeyGenerate, { cwd: projectPath() })

    if (result.isErr())
      errorHandler(result)

    log.info('Application key generated.')

    await create(cli)
  }

  await preinstall(cli)
  await prepublish(cli)
  await upgrade(cli)
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
  await migrate(cli)
  await seed(cli)
  await example(cli)
  await test(cli)
  await version(cli)

  cli.help()
  cli.version(await frameworkVersion())

  cli.parse()
}

main()
