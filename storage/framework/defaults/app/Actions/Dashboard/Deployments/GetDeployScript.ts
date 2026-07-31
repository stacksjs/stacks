import { Action } from '@stacksjs/actions'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import process from 'node:process'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'GetDeployScript',
  description: 'Gets the deploy script used by the application.',
  method: 'GET',
  apiResponse: true,

  async handle() {
    const filePath = join(process.cwd(), 'cloud', 'deploy-script.ts')
    try {
      return {
        path: 'cloud/deploy-script.ts',
        content: await readFile(filePath, 'utf8'),
        exists: true,
      }
    }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        return response.json({
          message: error instanceof Error ? error.message : 'Deploy script could not be read.',
        }, 500)
      }

      return {
        path: 'cloud/deploy-script.ts',
        content: '',
        exists: false,
      }
    }
  },
})
