import type { CLI } from '@stacksjs/types'
import { generateTestCoverageReport, invoke, typecheck } from './actions/test'

async function test(stacks: CLI) {
  stacks
    .command('test', 'Runs your test suite.')
    .action(async () => {
      await invoke()
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
