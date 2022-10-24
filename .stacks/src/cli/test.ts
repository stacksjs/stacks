import type { CLI } from '@stacksjs/types'
import { generateTestCoverageReport, runTestSuite, typecheck } from './actions/test'

async function test(stacks: CLI) {
  stacks
    .command('test', 'Runs your test suite.')
    .action(async () => {
      await runTestSuite()
    })

  stacks
    .command('test:types', 'Typechecks your codebase.')
    .action(async () => {
      await typecheck()
    })

  stacks
    .command('test:coverage', 'Generates a test coverage report.')
    .action(async () => {
      await generateTestCoverageReport()
    })
}

export { test }
