import type { RequestInstance } from '@stacksjs/types'
import type { UploadedFileLike } from '@stacksjs/storage'
import { Action } from '@stacksjs/actions'
import { response } from '@stacksjs/router'
import { DashboardFileError, uploadDashboardFiles } from './file-manager'

const MAX_FILES = 20
const MAX_FILE_BYTES = 10 * 1024 * 1024

export default new Action({
  name: 'FileUploadAction',
  description: 'Uploads files to a configured storage disk.',
  method: 'POST',
  async handle(request: RequestInstance) {
    const multiple = request.getFiles('files')
    const single = request.file('file')
    const files = (multiple.length ? multiple : single ? [single] : []) as UploadedFileLike[]

    if (!files.length)
      return response.json({ message: 'Choose at least one file.', fields: { files: 'Choose at least one file.' } }, 422)
    if (files.length > MAX_FILES)
      return response.json({ message: `Upload at most ${MAX_FILES} files at a time.`, fields: { files: `Choose ${MAX_FILES} files or fewer.` } }, 422)

    const oversized = files.find(file => Number((file as UploadedFileLike & { size?: number }).size || 0) > MAX_FILE_BYTES)
    if (oversized)
      return response.json({ message: 'Each file must be 10 MB or smaller.', fields: { files: 'A selected file exceeds 10 MB.' } }, 422)

    try {
      const uploaded = await uploadDashboardFiles({
        disk: String(request.get('disk', 'public')),
        path: String(request.get('path', '')),
        files,
      })
      return response.json({ uploaded }, 201)
    }
    catch (error) {
      if (error instanceof DashboardFileError)
        return response.json({ message: error.message, fields: error.fields }, error.status)
      throw error
    }
  },
})
