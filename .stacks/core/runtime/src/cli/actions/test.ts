import { consola } from '@stacksjs/cli'
import { runNpmScript } from '@stacksjs/utils'
import type { TestOptions } from '@stacksjs/types'
import { NpmScript } from '@stacksjs/types'

export async function invoke(options: TestOptions) {
  try {
    consola.info('Running your test suite...')
    await runNpmScript(NpmScript.Test, options)
    consola.success('Completed running the test suite.')
  }
  catch (error) {
    consola.error(error)
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
    consola.info('Typechecking your codebase...')
    await runNpmScript(NpmScript.TestTypes, options)
    consola.success('Completed the typecheck.')
  }
  catch (error) {
    consola.error(error)
  }
}

export async function testCoverageReport(options: TestOptions) {
  try {
    consola.info('Generating a test coverage report...')
    await runNpmScript(NpmScript.TestCoverage, options)
    consola.success('Generated the test coverage report.')
  }
  catch (error) {
    consola.error(error)
  }
}
