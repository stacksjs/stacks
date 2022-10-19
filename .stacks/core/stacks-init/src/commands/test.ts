import type { CAC } from 'cac'
import { generateTestCoverageReport, runTestSuite, typecheck } from '../actions/test'

async function test(artisan: CAC) {
  artisan
    .command('test', 'Runs your test suite.')
    .action(async () => {
      await runTestSuite()
    })

  artisan
    .command('test:types', 'Typechecks your codebase.')
    .action(async () => {
      await typecheck()
    })

  artisan
    .command('test:coverage', 'Generates a test coverage report.')
    .action(async () => {
      await generateTestCoverageReport()
    })
}

export { test }
