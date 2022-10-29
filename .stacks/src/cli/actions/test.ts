import { consola } from '@stacksjs/cli'
import { runNpmScript } from '@stacksjs/utils'
import { NpmScript } from '@stacksjs/types'

export async function typecheck() {
  consola.info('Typechecking your codebase...')

  try {
    await runNpmScript(NpmScript.TestTypes)
    consola.success('Finished typechecking your codebase.')
  }
  catch (error) {
    consola.error(error)
  }
}

export async function test() {
  consola.info('Running your test suite...')

  try {
    await runNpmScript(NpmScript.Test)
    consola.success('Completed running the test suite.')
  }
  catch (error) {
    consola.error(error)
  }
}

export async function generateTestCoverageReport() {
  consola.info('Generating a test coverage report...')

  try {
    await runNpmScript(NpmScript.TestCoverage)
    consola.success('Generated the test coverage report.')
  }
  catch (error) {
    consola.error(error)
  }
}
