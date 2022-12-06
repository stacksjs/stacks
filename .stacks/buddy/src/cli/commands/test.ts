import type { CLI, TestOptions } from '@stacksjs/types'
import { invoke, testCoverageReport, testUi, typecheck } from '../../actions/test'

const descriptions = {
  command: 'Runs your test suite',
  types: 'Typechecks your codebase',
  coverage: 'Generates a test coverage report',
  debug: 'Enable debug mode',
}

async function test(stacks: CLI) {
  stacks
    .command('test', descriptions.command)
    .option('--debug', descriptions.debug, { default: false })
    .action(async (options: TestOptions) => {
      await invoke(options)
    })

  stacks
    .command('test:ui', descriptions.command)
    .option('--debug', descriptions.debug, { default: false })
    .action(async (options: TestOptions) => {
      await testUi(options)
    })

  stacks
    .command('test:types', descriptions.types)
    .option('--debug', descriptions.debug, { default: false })
    .action(async (options: TestOptions) => {
      await typecheck(options)
    })

  stacks
    .command('test:coverage', descriptions.coverage)
    .option('--debug', descriptions.debug, { default: false })
    .action(async (options: TestOptions) => {
      await testCoverageReport(options)
    })
}

export { test }
