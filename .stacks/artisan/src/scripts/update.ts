import { NpmScript } from '../../../src/types'
import { runNpmScript } from './run-npm-script'

export async function updateStack() {
  await runNpmScript(NpmScript.Update)
}
