import type { CLI, CliOptions } from '@stacksjs/types'
import { invoke as fresh } from './actions/fresh'
import { lint, lintFix } from './actions/lint'
import { invoke as release } from './actions/release'
import { invoke as commit } from './actions/commit'
import { invoke as runClean } from './actions/clean'

async function utility(stacks: CLI) {
  stacks
    .command('fresh', 'Reinstalls your npm dependencies.')
    .option('--debug', 'Add additional debug logging', { default: false })
    .action(async (options: CliOptions) => {
      await fresh(options)
    })

  stacks
    .command('clean', 'Removes all node_modules & lock files.')
    .option('--debug', 'Add additional debug logging', { default: false })
    .action(async (options: CliOptions) => {
      await runClean(options)
    })

  stacks
    .command('lint', 'Automagically lints your codebase.')
    .option('--debug', 'Add additional debug logging', { default: false })
    .action(async (options: CliOptions) => {
      await lint(options)
    })

  stacks
    .command('lint:fix', 'Automagically fixes lint errors.')
    .option('--debug', 'Add additional debug logging', { default: false })
    .action(async (options: CliOptions) => {
      await lintFix(options)
    })

  stacks
    .command('release', 'Releases a new version of your libraries/packages.')
    .option('--debug', 'Add additional debug logging', { default: false })
    .action(async (options: CliOptions) => {
      await release(options)
    })

  stacks
    .command('commit', 'Commit your stashed changes.')
    .option('--debug', 'Add additional debug logging', { default: false })
    .action(async (options: CliOptions) => {
      await commit(options)
    })
}

export { utility }
