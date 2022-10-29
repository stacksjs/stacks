import type { CLI, TestOptions } from '@stacksjs/types'
import { invoke, testCoverageReport, typecheck } from './actions/test'

async function test(stacks: CLI) {
  stacks
    .command('test', 'Runs your test suite.')
    .action(async (options: TestOptions) => {
      await invoke(options)
    })

  stacks
    .command('test:types', 'Typechecks your codebase.')
    .action(async (options: TestOptions) => {
      await typecheck(options)
    })

  stacks
    .command('test:coverage', 'Generates a test coverage report.')
    .action(async (options: TestOptions) => {
      await testCoverageReport(options)
    })
}

export { test }
