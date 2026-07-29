import { Action } from '@stacksjs/actions'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import process from 'node:process'

export default new Action({
  name: 'GetDeployScript',
  description: 'Gets the deploy script used by the application.',
  apiResponse: true,

  async handle() {
    const filePath = join(process.cwd(), 'cloud', 'deploy-script.ts')
    try {
      return {
        path: 'cloud/deploy-script.ts',
        content: await readFile(filePath, 'utf8'),
      }
    }
    catch {
      return {
        path: 'cloud/deploy-script.ts',
        content: '',
        exists: false,
      }
    }
  },
})
