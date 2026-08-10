import type { RequestInstance } from '@stacksjs/types'
import { randomUUIDv7 } from 'bun'
import { Action } from '@stacksjs/actions'
import { mkdir, rename, rm, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import process from 'node:process'
import { response } from '@stacksjs/router'
import { dashboardOperationalError, dashboardOperationalIssue } from '../dashboard-response'

export default new Action({
  name: 'UpdateDeployScript',
  description: 'Updates the deploy script.',
  method: 'PUT',
  apiResponse: true,

  async handle(request: RequestInstance) {
    const content = String(request.get('content') || '')
    if (!content.trim())
      return response.json({ success: false, message: 'Deploy script content is required.' }, { status: 422 })
    if (Buffer.byteLength(content, 'utf8') > 256 * 1024)
      return response.json({ success: false, message: 'Deploy script must be smaller than 256 KB.' }, { status: 422 })

    try {
      new Bun.Transpiler({ loader: 'ts' }).transformSync(content)
    }
    catch (error) {
      return response.json({
        success: false,
        message: error instanceof Error ? error.message : 'Deploy script syntax is invalid.',
      }, { status: 422 })
    }

    const filePath = join(process.cwd(), 'cloud', 'deploy-script.ts')
    const temporaryPath = `${filePath}.${randomUUIDv7()}.tmp`
    try {
      await mkdir(dirname(filePath), { recursive: true })
      await writeFile(temporaryPath, content, { encoding: 'utf8', mode: 0o644 })
      await rename(temporaryPath, filePath)
    }
    catch (error) {
      try {
        await rm(temporaryPath, { force: true })
      }
      catch (cleanupError) {
        dashboardOperationalIssue(cleanupError, 'Temporary deploy script could not be removed.', 'UpdateDeployScript.cleanup')
      }
      return dashboardOperationalError(error, 'Deploy script could not be saved.', 'UpdateDeployScript', 500)
    }

    return {
      success: true,
      path: 'cloud/deploy-script.ts',
    }
  },
})
