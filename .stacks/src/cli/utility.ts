import type { CLI } from '@stacksjs/types'
import { reinstallNpmDependencies } from './actions/fresh'
import { lint, lintFix } from './actions/lint'
import { release } from './actions/release'
import { commit } from './actions/commit'

async function utility(stacks: CLI) {
  stacks
    .command('fresh', 'Reinstalls your npm dependencies.')
    .action(async () => {
      await reinstallNpmDependencies()
    })

  stacks
    .command('lint', 'Automagically lints your codebase.')
    .action(async () => {
      await lint()
    })

  stacks
    .command('lint:fix', 'Automagically fixes lint errors.')
    .action(async () => {
      await lintFix()
    })

  stacks
    .command('release', 'Releases a new version of your libraries/packages.')
    .action(async () => {
      await release()
    })

  stacks
    .command('commit', 'Commit your stashed changes.')
    .action(async () => {
      await commit()
    })
}

export { utility }
