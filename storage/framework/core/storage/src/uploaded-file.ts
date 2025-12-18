import { basename, extname, join } from 'node:path'
import { Storage } from './facade'

export interface UploadedFileOptions {
  hashName?: boolean
}

export class UploadedFile {
  private _file: File
  private _hashName: string | null = null

  constructor(file: File) {
    this._file = file
  }

  /** Get the original file name */
  get name(): string {
    return this._file.name
  }

  /** Get the file extension */
  get extension(): string {
    return extname(this._file.name).slice(1).toLowerCase()
  }

  /** Get the client MIME type */
  get mimeType(): string {
    return this._file.type
  }

  /** Get the file size in bytes */
  get size(): number {
    return this._file.size
  }

  /** Get the underlying File object */
  get file(): File {
    return this._file
  }

  /** Generate a hash-based filename */
  hashName(extension?: string): string {
    if (!this._hashName) {
      const hash = crypto.randomUUID().replace(/-/g, '').slice(0, 32)
      const ext = extension || this.extension
      this._hashName = ext ? `${hash}.${ext}` : hash
    }
    return this._hashName
  }

  /** Get the file contents as ArrayBuffer */
  async arrayBuffer(): Promise<ArrayBuffer> {
    return this._file.arrayBuffer()
  }

  /** Get the file contents as Uint8Array */
  async bytes(): Promise<Uint8Array> {
    const buffer = await this._file.arrayBuffer()
    return new Uint8Array(buffer)
  }

  /** Get the file contents as text */
  async text(): Promise<string> {
    return this._file.text()
  }

  /** Check if the file is valid (has size) */
  isValid(): boolean {
    return this._file.size > 0
  }

  /**
   * Store the file to a disk
   * @param path Directory path or full path
   * @param disk Disk name (default: 'local')
   * @returns The stored path
   */
  async store(path: string = '', disk: string = 'local'): Promise<string> {
    const filename = this.hashName()
    const fullPath = path ? join(path, filename) : filename
    const contents = await this.bytes()

    await Storage.disk(disk).write(fullPath, contents)

    return fullPath
  }

  /**
   * Store the file with a specific name
   * @param path Directory path
   * @param name Filename (without path)
   * @param disk Disk name (default: 'local')
   * @returns The stored path
   */
  async storeAs(path: string, name: string, disk: string = 'local'): Promise<string> {
    const fullPath = path ? join(path, name) : name
    const contents = await this.bytes()

    await Storage.disk(disk).write(fullPath, contents)

    return fullPath
  }

  /**
   * Store the file publicly (to public disk)
   * @param path Directory path
   * @returns The stored path
   */
  async storePublicly(path: string = ''): Promise<string> {
    return this.store(path, 'public')
  }

  /**
   * Store the file publicly with a specific name
   * @param path Directory path
   * @param name Filename
   * @returns The stored path
   */
  async storePubliclyAs(path: string, name: string): Promise<string> {
    return this.storeAs(path, name, 'public')
  }

  /**
   * Move the file to a new location
   * @param path Full destination path
   * @param disk Disk name
   */
  async move(path: string, disk: string = 'local'): Promise<string> {
    const contents = await this.bytes()
    await Storage.disk(disk).write(path, contents)
    return path
  }

  /** Get the original filename without extension */
  getClientOriginalName(): string {
    return basename(this._file.name, extname(this._file.name))
  }

  /** Get the original extension */
  getClientOriginalExtension(): string {
    return this.extension
  }

  /** Get the client MIME type */
  getClientMimeType(): string {
    return this._file.type
  }

  /** Get human-readable size */
  getSize(): string {
    const bytes = this._file.size
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
  }

  /** Check if file matches any of the given MIME types */
  isOneOf(mimeTypes: string[]): boolean {
    return mimeTypes.some(type => {
      if (type.endsWith('/*')) {
        const category = type.slice(0, -2)
        return this._file.type.startsWith(category)
      }
      return this._file.type === type
    })
  }

  /** Check if file is an image */
  isImage(): boolean {
    return this._file.type.startsWith('image/')
  }

  /** Check if file is a video */
  isVideo(): boolean {
    return this._file.type.startsWith('video/')
  }

  /** Check if file is audio */
  isAudio(): boolean {
    return this._file.type.startsWith('audio/')
  }

  /** Check if file is a PDF */
  isPdf(): boolean {
    return this._file.type === 'application/pdf'
  }
}

/**
 * Create UploadedFile from native File
 */
export function uploadedFile(file: File): UploadedFile {
  return new UploadedFile(file)
}

/**
 * Create multiple UploadedFiles from native Files
 */
export function uploadedFiles(files: File[]): UploadedFile[] {
  return files.map(f => new UploadedFile(f))
}
