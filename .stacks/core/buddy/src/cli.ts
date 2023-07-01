#!/usr/bin/env node
import { runAction } from '@stacksjs/actions'
import { handleError } from '@stacksjs/error-handling'
import { command, log } from '@stacksjs/cli'
import { env } from '@stacksjs/validation'
import { frameworkVersion, installIfVersionMismatch, isProjectCreated } from '@stacksjs/utils'
import { projectPath } from '@stacksjs/path'
import { Action } from '@stacksjs/types'
import { build, changelog, clean, commit, create, deploy, dev, example, fresh, generate, key, lint, make, migrate, preinstall, prepublish, release, seed, setup, test, upgrade, version } from './commands'

const cli = command('buddy')

// setup global error handlers
process.on('uncaughtException', handleError)
process.on('unhandledRejection', handleError)

async function main() {
  // the following commands are not dependent on the project being initialized
  await installIfVersionMismatch()
  await setup(cli)
  await key(cli)

  // before running any commands, check if the project is already initialized
  if (!await isProjectCreated())
    await initProject()

  await preinstall(cli)
  await prepublish(cli)
  await upgrade(cli)
  await generate(cli)
  await dev(cli)
  await build(cli)
  await changelog(cli)
  await clean(cli)
  await commit(cli)
  await deploy(cli)
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

async function initProject() {
  console.log('env.APP_ENV?')
  console.log('env.APP_ENV', env.APP_ENV)

  if (env.APP_ENV !== 'production')
    log.info('Project not yet initialized, generating application key...')
  else
    handleError(new Error('Please run `buddy key:generate` to generate an application key'))

  const result = await runAction(Action.KeyGenerate, { cwd: projectPath() })

  if (result.isErr())
    handleError(result.error as Error)

  log.info('Application key generated.')

  await create(cli)
}

main()
