import consola from 'consola'
import { NpmScript } from '../../../core'
import { runNpmScript } from './run-npm-script'

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

export async function runTestSuite() {
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
