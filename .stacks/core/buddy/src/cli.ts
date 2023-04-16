#!/usr/bin/env node
import { runAction } from '@stacksjs/actions'
import { command, execSync, log, runCommand } from '@stacksjs/cli'
import { env, frameworkVersion, isProjectCreated, parseYaml, semver } from '@stacksjs/utils'
import { projectPath } from '@stacksjs/path'
import { Action } from '@stacksjs/types'
import { filesystem } from '@stacksjs/storage'
import { build, changelog, clean, commit, create, dev, example, fresh, generate, key, lint, make, migrate, preinstall, prepublish, release, seed, setup, test, update, version } from './commands'

const cli = command('stacks')
const { fs } = filesystem

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
      log.info('Project not yet initialized, generating application key...')
    }
    else {
      log.error('Please run `buddy key:generate` to generate an application key.')
      process.exit()
    }

    const result = await runAction(Action.KeyGenerate, { cwd: projectPath() })

    if (result.isErr()) {
      log.error(result.error)
      process.exit()
    }

    log.info('Application key generated.')

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

async function installIfVersionMismatch() {
  const dependenciesYaml = fs.readFileSync(projectPath('tea.yaml'), 'utf8')
  const dependencies = parseYaml(dependenciesYaml).dependencies

  const requiredNodeVersion = dependencies['nodejs.org']
  const requiredPnpmVersion = dependencies['pnpm.io']

  const installedNodeVersion = process.version
  const installedPnpmVersion = execSync('pnpm -v').trim()

  if (!semver.satisfies(installedNodeVersion, requiredNodeVersion)) {
    log.error(`Installed Node.js version (${installedNodeVersion}) does not satisfy required version (${requiredNodeVersion}). Installing...`)
    await runCommand(`tea +nodejs.org${requiredNodeVersion} >/dev/null 2>&1`)
  }

  if (!semver.satisfies(installedPnpmVersion, requiredPnpmVersion)) {
    log.error(`Installed pnpm version (${installedPnpmVersion}) does not satisfy required version (${requiredPnpmVersion}). Installing...`)
    await runCommand(`tea +pnpm.io${requiredPnpmVersion} >/dev/null 2>&1`)
  }
}

function errorHandler(error: Error): void {
  log.error(error)
  process.exit()
}
