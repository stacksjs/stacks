import { NpmScript } from '../../../src/types'
import { runNpmScript } from './run-npm-script'

export async function stacks() {
  await runNpmScript(NpmScript.Update)
}
