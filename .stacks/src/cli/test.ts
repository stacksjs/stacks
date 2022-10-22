import type { CAC } from 'cac'
import { generateTestCoverageReport, runTestSuite, typecheck } from './actions/test'

async function test(stacks: CAC) {
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
