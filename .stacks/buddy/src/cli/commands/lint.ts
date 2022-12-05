import type { CLI, LintOptions } from '@stacksjs/types'
import { invoke, lintFix } from '@stacksjs/actions/buddy/lint'

const descriptions = {
  lint: 'Automagically lints your codebase',
  lintFix: 'Automagically fixes lint errors',
  debug: 'Enable debug mode',
}

async function lint(stacks: CLI) {
  stacks
    .command('lint', descriptions.lint)
    .option('-f, --fix', descriptions.lintFix, { default: false })
    .option('--debug', descriptions.debug, { default: false })
    .action(async (options: LintOptions) => {
      await invoke(options)
    })

  stacks
    .command('lint:fix', descriptions.lintFix)
    .option('--debug', descriptions.debug, { default: false })
    .action(async (options: LintOptions) => {
      await lintFix(options)
    })
}

export { lint }
