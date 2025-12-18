import { Action } from '@stacksjs/actions'
import { Storage } from '@stacksjs/storage'

interface Request {
  file: (key: string) => any
  hasFile: (key: string) => boolean
  get: (key: string, defaultValue?: any) => any
}

export default new Action({
  name: 'Upload Test',
  description: 'Test file upload to public directory',

  async handle(request?: Request) {
    if (!request) {
      return { success: false, message: 'No request provided' }
    }

    // Check if file was uploaded
    if (!request.hasFile('file')) {
      return { success: false, message: 'No file uploaded' }
    }

    const file = request.file('file')
    if (!file) {
      return { success: false, message: 'File is empty' }
    }

    // Get optional directory from request
    const directory = request.get('directory', 'uploads')

    try {
      // Store to public directory using UploadedFile methods
      const path = await file.storePublicly(directory)

      return {
        success: true,
        message: 'File uploaded successfully',
        data: {
          path,
          name: file.name,
          size: file.getSize(),
          mimeType: file.mimeType,
          extension: file.extension,
          isImage: file.isImage(),
          url: `/storage/${path}`,
        },
      }
    }
    catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Upload failed',
      }
    }
  },
})
