import type { TestOptions } from '@stacksjs/types'
import { ExitCode, NpmScript } from '@stacksjs/types'
import { intro, outro, runCommand } from '@stacksjs/cli'

export async function invoke(options: TestOptions) {
  const perf = intro('buddy test')
  const result = await runCommand(NpmScript.Test, { ...options, debug: true })

  if (result.isErr()) {
    outro('While running `buddy test`, there was an issue', { startTime: perf, useSeconds: true, isError: true }, result.error)
    process.exit(ExitCode.FatalError)
  }

  outro('Finished running tests', { startTime: perf, useSeconds: true })
}

export async function testUi(options: TestOptions) {
  const perf = intro('buddy test:ui')
  const result = await runCommand(NpmScript.TestUi, { ...options, debug: true })

  if (result.isErr()) {
    outro('While running `buddy test:ui`, there was an issue', { startTime: perf, useSeconds: true, isError: true }, result.error)
    process.exit(ExitCode.FatalError)
  }
}

/**
 * An alias of the invoke method.
 * @param options
 * @returns
 */
export async function test(options: TestOptions) {
  return invoke(options)
}

export async function typecheck(options: TestOptions) {
  const perf = intro('buddy test:types')
  const result = await runCommand(NpmScript.TestTypes, options)

  if (result.isErr()) {
    outro('While running `buddy test:types`, there was an issue', { startTime: perf, useSeconds: true, isError: true }, result.error)
    process.exit(ExitCode.FatalError)
  }

  outro('Finished typecheck', { startTime: perf, useSeconds: true })
  process.exit(ExitCode.Success)
}

export async function testCoverageReport(options: TestOptions) {
  const perf = intro('buddy test:coverage')
  const result = await runCommand(NpmScript.TestCoverage, options)

  if (result.isErr()) {
    outro('While running `buddy test:coverage`, there was an issue', { startTime: perf, useSeconds: true, isError: true }, result.error)
    process.exit(ExitCode.FatalError)
  }

  outro('Generated the test coverage report', { startTime: perf, useSeconds: true })
  process.exit(ExitCode.Success)
}
