import type { ChecksumOptions, DirectoryListing, FileContents, MimeTypeOptions, PublicUrlOptions, StatEntry, TemporaryUrlOptions } from '@flystorage/file-storage'

import type { StorageDriver } from '@stacksjs/types'

import type { Buffer } from 'node:buffer'

import { FileStorage } from '@flystorage/file-storage'
import { InMemoryStorageAdapter } from '@flystorage/in-memory'

const adapter = new InMemoryStorageAdapter()

export const memoryStorage: FileStorage = new FileStorage(adapter)

export const memory: StorageDriver = {
  async write(path: string, contents: FileContents): Promise<void> {
    await localStorage.write(path, contents)
  },

  async deleteFile(path: string): Promise<void> {
    await localStorage.deleteFile(path)
  },

  async createDirectory(path: string): Promise<void> {
    await localStorage.createDirectory(path)
  },

  async moveFile(from: string, to: string): Promise<void> {
    await localStorage.moveFile(from, to)
  },

  async copyFile(from: string, to: string): Promise<void> {
    await localStorage.copyFile(from, to)
  },

  async stat(path: string): Promise<StatEntry> {
    return await localStorage.stat(path)
  },

  list(path: string, options: { deep: boolean }): DirectoryListing {
    return localStorage.list(path, options)
  },

  async changeVisibility(path: string, visibility: string): Promise<void> {
    await localStorage.changeVisibility(path, visibility)
  },

  async visibility(path: string): Promise<string> {
    return await localStorage.visibility(path)
  },

  async fileExists(path: string): Promise<boolean> {
    return await localStorage.fileExists(path)
  },

  async directoryExists(path: string): Promise<boolean> {
    return await localStorage.directoryExists(path)
  },

  async publicUrl(path: string, options: PublicUrlOptions): Promise<string> {
    return await localStorage.publicUrl(path, options)
  },

  async temporaryUrl(path: string, options: TemporaryUrlOptions): Promise<string> {
    return await localStorage.temporaryUrl(path, options)
  },

  async checksum(path: string, options: ChecksumOptions): Promise<string> {
    return await localStorage.checksum(path, options)
  },

  async mimeType(path: string, options: MimeTypeOptions): Promise<string> {
    return await localStorage.mimeType(path, options)
  },

  async lastModified(path: string): Promise<number> {
    return await localStorage.lastModified(path)
  },

  async fileSize(path: string): Promise<number> {
    return await localStorage.fileSize(path)
  },

  async read(path: string): Promise<FileContents> {
    const contents = await localStorage.read(path)

    return contents
  },
  async readToString(path: string): Promise<string> {
    const contents = await localStorage.readToString(path)

    return contents
  },
  async readToBuffer(path: string): Promise<Buffer> {
    const contents = await localStorage.readToBuffer(path)

    return contents
  },
  async readToUint8Array(path: string): Promise<Uint8Array> {
    const contents = await localStorage.readToUint8Array(path)

    return contents
  },
}
