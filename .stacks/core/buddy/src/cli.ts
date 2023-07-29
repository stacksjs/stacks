import { handleError } from '@stacksjs/error-handling'
import { command } from '@stacksjs/cli'
import { frameworkVersion, initProject, isProjectCreated } from '@stacksjs/utils'
import { build, changelog, clean, commit, deploy, dev, example, fresh, generate, key, lint, make, migrate, preinstall, prepublish, release, seed, setup, test, upgrade, version } from './commands'

const cli = command.cli('buddy')

// setup global error handlers
process.on('uncaughtException', handleError)
process.on('unhandledRejection', handleError)

async function main() {
  // the following commands are not dependent on the project being initialized
  // await installIfVersionMismatch()
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

main()
