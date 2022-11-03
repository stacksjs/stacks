import type { CLI, CleanOptions, CommitOptions, FreshOptions, LintOptions, ReleaseOptions } from '@stacksjs/types'
import { invoke as fresh } from '../actions/fresh'
import { lint, lintFix } from '../actions/lint'
import { invoke as release } from '../actions/release'
import { invoke as commit } from '../actions/commit'
import { invoke as runClean } from '../actions/clean'

const descriptions = {
  fresh: 'Reinstalls your npm dependencies',
  clean: 'Removes all node_modules & lock files',
  lint: 'Automagically lints your codebase',
  lintFix: 'Automagically fixes lint errors',
  commit: 'Commit your stashed changes',
  release: 'Releases a new version of your libraries/packages',
  debug: 'Enable debug mode',
}

async function utility(stacks: CLI) {
  stacks
    .command('fresh', descriptions.fresh)
    .option('--debug', descriptions.debug, { default: false })
    .action(async (options: FreshOptions) => {
      await fresh(options)
    })

  stacks
    .command('clean', descriptions.clean)
    .option('--debug', descriptions.debug, { default: false })
    .action(async (options: CleanOptions) => {
      await runClean(options)
    })

  stacks
    .command('lint', descriptions.lint)
    .option('--debug', descriptions.debug, { default: false })
    .action(async (options: LintOptions) => {
      await lint(options)
    })

  stacks
    .command('lint:fix', descriptions.lintFix)
    .option('--debug', descriptions.debug, { default: false })
    .action(async (options: LintOptions) => {
      await lintFix(options)
    })

  stacks
    .command('release', descriptions.release)
    .option('--debug', descriptions.debug, { default: false })
    .action(async (options: ReleaseOptions) => {
      await release(options)
    })

  stacks
    .command('commit', descriptions.commit)
    .option('--debug', descriptions.debug, { default: false })
    .action(async (options: CommitOptions) => {
      await commit(options)
    })
}

export { utility }
