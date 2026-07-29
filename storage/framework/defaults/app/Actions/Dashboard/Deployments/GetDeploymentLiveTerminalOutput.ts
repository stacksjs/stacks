import { Action } from '@stacksjs/actions'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import process from 'node:process'
import { logging } from '@stacksjs/config'
import { tailLines } from './deployment-input'

export default new Action({
  name: 'GetDeploymentLiveTerminalOutput',
  description: 'Gets the live terminal output of the deployment.',
  apiResponse: true,

  async handle() {
    const configuredPath = logging.deploymentsPath || 'storage/logs/deployments.log'
    const filePath = resolve(process.cwd(), configuredPath)
    try {
      return {
        path: configuredPath,
        output: tailLines(await readFile(filePath, 'utf8')),
      }
    }
    catch {
      return {
        path: configuredPath,
        output: '',
        exists: false,
      }
    }
  },
})
