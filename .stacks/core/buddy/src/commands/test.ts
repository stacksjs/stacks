import type { CLI, TestOptions } from '@stacksjs/types'
import { runAction } from '@stacksjs/actions'
import { intro, outro } from '@stacksjs/cli'
import { projectPath } from '@stacksjs/path'
import { Action } from '@stacksjs/types'

async function test(buddy: CLI) {
  const descriptions = {
    command: 'Runs your test suite',
    types: 'Typechecks your codebase',
    coverage: 'Generates a test coverage report',
    ui: 'Runs your test suite in the browser',
    unit: 'Runs your unit tests',
    feature: 'Runs your feature tests',
    showReport: 'Show the test report',
    verbose: 'Enable verbose output',
  }

  buddy
    .command('test', descriptions.command)
    .option('--ui', descriptions.ui, { default: false })
    .option('--verbose', descriptions.verbose, { default: true })
    .action(async (options: TestOptions) => {
      const perf = await intro('buddy test')
      const result = await runAction(Action.Test, { ...options, cwd: projectPath() })
      console.log('result', result)

      // if (result.isErr()) {
      //   outro('While running `buddy test`, there was an issue', { startTime: perf, useSeconds: true, isError: true }, result.error)
      //   process.exit()
      // }

      outro('Finished running tests', { startTime: perf, useSeconds: true })
    })

  buddy
    .command('test:unit', descriptions.unit)
    .option('--verbose', descriptions.verbose, { default: false })
    .action(async (options: TestOptions) => {
      const perf = await intro('buddy test:unit')
      const result = await runAction(Action.TestUnit, { ...options, verbose: true, cwd: projectPath() })
      console.log('result', result)

      // if (result.isErr()) {
      //   outro('While running `buddy test:unit`, there was an issue', { startTime: perf, useSeconds: true, isError: true }, result.error)
      //   process.exit()
      // }

      outro('Finished running unit tests', { startTime: perf, useSeconds: true })
    })

  buddy
    .command('test:feature', descriptions.feature)
    .option('--show-report', descriptions.showReport, { default: false })
    .option('--verbose', descriptions.verbose, { default: false })
    .action(async (options: TestOptions) => {
      const perf = await intro('buddy test:feature')
      // let result

      // if (options.showReport)
      //   result = await runAction(Action.ShowFeatureTestReport, { ...options, verbose: true, cwd: projectPath() })
      // else
      //   result = await runAction(Action.TestFeature, { ...options, verbose: true, cwd: projectPath() })

      // if (result.isErr()) {
      //   outro('While running `buddy test:feature`, there was an issue', { startTime: perf, useSeconds: true, isError: true }, result.error)
      //   process.exit()
      // }

      outro('Finished running feature tests', { startTime: perf, useSeconds: true })
    })

  buddy
    .command('test:ui', descriptions.command)
    .option('--verbose', descriptions.verbose, { default: false })
    .action(async (options: TestOptions) => {
      const perf = await intro('buddy test:ui')
      const result = await runAction(Action.TestUi, { ...options, verbose: true, cwd: projectPath() })
      console.log('result', result)

      // if (result.isErr()) {
      //   outro('While running `buddy test:ui`, there was an issue', { startTime: perf, useSeconds: true, isError: true }, result.error)
      //   process.exit()
      // }

      outro('Finished running tests in the browser', { startTime: perf, useSeconds: true })
    })

  buddy
    .command('test:types', descriptions.types)
    .alias('typecheck')
    .option('--verbose', descriptions.verbose, { default: false })
    .action(async (options: TestOptions) => {
      const perf = await intro('buddy test:types')
      const result = await runAction(Action.Typecheck, { ...options, verbose: true, cwd: projectPath() })
      console.log('result', result)

      // if (result.isErr()) {
      //   outro('While running `buddy test:types`, there was an issue', { startTime: perf, useSeconds: true, isError: true }, result.error)
      //   process.exit()
      // }

      outro('Finished running typecheck', { startTime: perf, useSeconds: true })
    })

  buddy
    .command('test:coverage', descriptions.coverage)
    .action(async (options: TestOptions) => {
      const perf = await intro('buddy test:coverage')
      const result = await runAction(Action.TestCoverage, { ...options, cwd: projectPath(), verbose: true })
      console.log('result', result)

      // if (result.isErr()) {
      //   outro('While running `buddy test:coverage`, there was an issue', { startTime: perf, useSeconds: true, isError: true }, result.error)
      //   process.exit()
      // }

      outro('Generated the test coverage report', { startTime: perf, useSeconds: true })
      process.exit()
    })
}

export { test }
