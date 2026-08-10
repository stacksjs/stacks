import { Action } from '@stacksjs/actions'
import { readFile } from 'node:fs/promises'
import { isAbsolute, relative, resolve, sep } from 'node:path'
import process from 'node:process'
import { logging } from '@stacksjs/config'
import { dashboardOperationalError } from '../dashboard-response'
import { tailLines } from './deployment-input'

export default new Action({
  name: 'GetDeploymentLiveTerminalOutput',
  description: 'Gets the live terminal output of the deployment.',
  method: 'GET',
  apiResponse: true,

  async handle() {
    const configuredPath = logging.deploymentsPath || 'storage/logs/deployments.log'
    const filePath = resolve(process.cwd(), configuredPath)
    const relativePath = relative(process.cwd(), filePath)
    const publicPath = relativePath && relativePath !== '..' && !relativePath.startsWith(`..${sep}`) && !isAbsolute(relativePath)
      ? relativePath
      : 'deployments.log'
    try {
      return {
        path: publicPath,
        output: tailLines(await readFile(filePath, 'utf8')),
        exists: true,
      }
    }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT')
        return dashboardOperationalError(error, 'Deployment output could not be read.', 'GetDeploymentLiveTerminalOutput', 500)

      return {
        path: publicPath,
        output: '',
        exists: false,
      }
    }
  },
})
