import { copyFiles } from 'stacks'
import { NpmScript } from '../../../src/types'
import { runNpmScript } from './run-npm-script'

export async function stacks() {
  await runNpmScript(NpmScript.Update)

  // update the framework
  copyFiles('../../../node_modules/@stacksjs/framework', '../../../../.stacks')

  // TODO: how to gracefully handle potential overwrites?
}
