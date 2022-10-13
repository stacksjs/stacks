import type { CAC } from 'cac'
import { reinstallNpmDependencies } from '../actions/fresh'
import { lint, lintFix } from '../actions/lint'
import { release } from '../actions/release'
import { commit } from '../actions/commit'

async function utilityCommands(artisan: CAC) {
  artisan
    .command('fresh', 'Reinstalls your npm dependencies.')
    .action(async () => {
      await reinstallNpmDependencies()
    })

  artisan
    .command('lint', 'Automagically lints your codebase.')
    .action(async () => {
      await lint()
    })

  artisan
    .command('lint:fix', 'Automagically fixes lint errors.')
    .action(async () => {
      await lintFix()
    })

  artisan
    .command('release', 'Releases a new version of your libraries/packages.')
    .action(async () => {
      await release()
    })

  artisan
    .command('commit', 'Commit your stashed changes.')
    .action(async () => {
      await commit()
    })
}

export { utilityCommands }
