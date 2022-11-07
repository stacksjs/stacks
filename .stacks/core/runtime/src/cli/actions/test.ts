import { log } from '@stacksjs/logging'
import { runNpmScript } from '@stacksjs/utils'
import type { TestOptions } from '@stacksjs/types'
import { ExitCode, NpmScript } from '@stacksjs/types'

export async function invoke(options: TestOptions) {
  try {
    log.info('Running your test suite...')
    await runNpmScript(NpmScript.Test, options)
    log.success('Completed running the test suite.')
  }
  catch (error) {
    log.error('There was an error testing your stack.')
    log.error(error)
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
  try {
    log.info('Typechecking your codebase...')
    await runNpmScript(NpmScript.TestTypes, options)
    log.success('Completed the typecheck.')
  }
  catch (error) {
    log.error(error)
  }
}

export async function testCoverageReport(options: TestOptions) {
  try {
    log.info('Generating a test coverage report...')
    await runNpmScript(NpmScript.TestCoverage, options)
    log.success('Generated the test coverage report.')
  }
  catch (error) {
    log.error(error)
  }
}
