export interface UploadedFileInfo {
  name: string
  type: string
  size: number
  lastModified: number
  path?: string
}

export class UploadedFile {
  private file: File

  constructor(file: File) {
    this.file = file
  }

  /**
   * Get the original name of the uploaded file
   */
  getClientOriginalName(): string {
    return this.file.name
  }

  /**
   * Get the original extension of the uploaded file
   */
  getClientOriginalExtension(): string {
    const name = this.getClientOriginalName()
    const lastDotIndex = name.lastIndexOf('.')
    return lastDotIndex !== -1 ? name.substring(lastDotIndex + 1) : ''
  }

  /**
   * Get the MIME type of the uploaded file
   */
  getMimeType(): string {
    return this.file.type
  }

  /**
   * Get the size of the uploaded file in bytes
   */
  getSize(): number {
    return this.file.size
  }

  /**
   * Check if the file was uploaded successfully
   */
  isValid(): boolean {
    return this.getSize() > 0
  }

  /**
   * Get the file extension based on the MIME type
   */
  guessExtension(): string {
    const mimeType = this.getMimeType()
    const extensionMap: Record<string, string> = {
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/gif': 'gif',
      'image/webp': 'webp',
      'image/svg+xml': 'svg',
      'application/pdf': 'pdf',
      'text/plain': 'txt',
      'text/html': 'html',
      'text/css': 'css',
      'text/javascript': 'js',
      'application/javascript': 'js',
      'application/json': 'json',
      'application/xml': 'xml',
      'application/zip': 'zip',
      'application/x-zip-compressed': 'zip',
      'audio/mpeg': 'mp3',
      'audio/wav': 'wav',
      'video/mp4': 'mp4',
      'video/webm': 'webm',
      'video/ogg': 'ogv',
    }

    return extensionMap[mimeType] || this.getClientOriginalExtension()
  }

  /**
   * Get the file extension (alias for guessExtension)
   */
  extension(): string {
    return this.guessExtension()
  }

  /**
   * Get the filename without extension
   */
  getFilename(): string {
    const name = this.getClientOriginalName()
    const lastDotIndex = name.lastIndexOf('.')
    return lastDotIndex !== -1 ? name.substring(0, lastDotIndex) : name
  }

  /**
   * Get the file as a File object
   */
  getFile(): File {
    return this.file
  }

  /**
   * Get the file as an ArrayBuffer
   */
  async getBuffer(): Promise<ArrayBuffer> {
    return await this.file.arrayBuffer()
  }

  /**
   * Get the file as a Blob
   */
  getBlob(): Blob {
    return this.file
  }

  /**
   * Get the file as a string (for text files)
   */
  async getString(): Promise<string> {
    return await this.file.text()
  }
}
