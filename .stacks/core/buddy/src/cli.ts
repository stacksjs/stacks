#!/usr/bin/env node
import { readFileSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { runAction } from '@stacksjs/actions'
import { command, log } from '@stacksjs/cli'
import { env, frameworkVersion, isProjectCreated } from '@stacksjs/utils'
import { projectPath } from '@stacksjs/path'
import { Action } from '@stacksjs/types'
import semver from 'semver'
import { build, changelog, clean, commit, create, dev, example, fresh, generate, key, lint, make, migrate, preinstall, prepublish, release, seed, setup, test, update, version } from './commands'

const cli = command('stacks')

// setup global error handlers
process.on('uncaughtException', errorHandler)
process.on('unhandledRejection', errorHandler)

async function main() {
  // the following commands are not dependent on the project being initialized
  installIfVersionMismatch()
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

function installIfVersionMismatch(): void {
  const packageJson = JSON.parse(readFileSync('./package.json', 'utf8'))
  const requiredVersion = packageJson.engines.pnpm
  const installedVersion = execSync('pnpm -v', { encoding: 'utf8' }).trim()

  if (!semver.satisfies(installedVersion, requiredVersion)) {
    log.error(`Installed pnpm version (${installedVersion}) does not satisfy required version (${requiredVersion}). Installing...`)
    execSync('pnpm i -g pnpm', { stdio: 'inherit' })
  }
}

function errorHandler(error: Error): void {
  log.error(error)
  process.exit()
}
