import type { CLI, TestOptions } from '@stacksjs/types'
import { invoke, testCoverageReport, testUi, typecheck } from '@stacksjs/actions/test'

async function test(buddy: CLI) {
  const descriptions = {
    command: 'Runs your test suite',
    types: 'Typechecks your codebase',
    coverage: 'Generates a test coverage report',
    debug: 'Enable debug mode',
  }

  buddy
    .command('test', descriptions.command)
    .option('--debug', descriptions.debug, { default: false })
    .action(async (options: TestOptions) => {
      await invoke(options)
    })

  buddy
    .command('test:ui', descriptions.command)
    .option('--debug', descriptions.debug, { default: false })
    .action(async (options: TestOptions) => {
      await testUi(options)
    })

  buddy
    .command('test:types', descriptions.types)
    .option('--debug', descriptions.debug, { default: false })
    .action(async (options: TestOptions) => {
      await typecheck(options)
    })

  buddy
    .command('test:coverage', descriptions.coverage)
    .option('--debug', descriptions.debug, { default: false })
    .action(async (options: TestOptions) => {
      await testCoverageReport(options)
    })
}

export { test }
