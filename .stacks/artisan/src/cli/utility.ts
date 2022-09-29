import type { CAC } from 'cac'
import { reinstallNpmDependencies } from '../scripts/fresh'
import { lint, lintFix } from '../scripts/lint'
import { release } from '../scripts/release'
import { commit } from '../scripts/commit'
import { generateTypes } from '../scripts/generate'

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

  artisan
    .command('generate:types', 'Generates the types of your library/libraries.')
    .action(async () => {
      await generateTypes()
    })
}

export { utilityCommands }
