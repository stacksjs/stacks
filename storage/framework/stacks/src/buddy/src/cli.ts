import process from 'node:process'
import { handleError } from 'src/error-handling/src'
import { cli } from 'src/cli/src'
import { ensureProjectIsInitialized } from 'src/utils/src'
import * as cmd from './commands'

// setup global error handlers
process.on('uncaughtException', handleError)
process.on('unhandledRejection', handleError)

async function main() {
  const buddy = cli('buddy')

  // the following commands are not dependent on the project being initialized
  // await installIfVersionMismatch()
  cmd.setup(buddy)
  cmd.key(buddy)

  // before running any commands, ensure the project is already initialized
  await ensureProjectIsInitialized()

  // cmd.prepublish(buddy)
  // cmd.upgrade(buddy)
  // cmd.generate(buddy)
  cmd.dev(buddy)
  cmd.build(buddy)
  // cmd.changelog(buddy)
  cmd.clean(buddy)
  cmd.cloud(buddy)
  // cmd.commit(buddy)
  cmd.deploy(buddy)
  cmd.configure(buddy)
  cmd.domains(buddy)
  cmd.fresh(buddy)
  cmd.http(buddy)
  cmd.install(buddy)
  cmd.dns(buddy)
  // cmd.lint(buddy)
  cmd.release(buddy)
  // cmd.make(buddy)
  // cmd.migrate(buddy)
  // cmd.seed(buddy)
  cmd.setup(buddy)
  // cmd.example(buddy)
  // cmd.test(buddy)
  // cmd.version(buddy)

  buddy.parse()
}

await main()
