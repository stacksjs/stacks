import type { ChecksumOptions, DirectoryListing, FileContents, MimeTypeOptions, PublicUrlOptions, StatEntry, TemporaryUrlOptions } from '@flystorage/file-storage'
import type { StorageDriver } from '@stacksjs/types'
import type { Buffer } from 'node:buffer'
import { S3Client } from '@aws-sdk/client-s3'
import { AwsS3StorageAdapter } from '@flystorage/aws-s3'
import { FileStorage } from '@flystorage/file-storage'

const client = new S3Client()
const adapter = new AwsS3StorageAdapter(client, {
  bucket: 'stacks',
  prefix: 'stx',
})

export const awsStorage: FileStorage = new FileStorage(adapter)

export const aws: StorageDriver = {
  async write(path: string, contents: FileContents): Promise<void> {
    await awsStorage.write(path, contents)
  },

  async deleteFile(path: string): Promise<void> {
    await awsStorage.deleteFile(path)
  },

  async createDirectory(path: string): Promise<void> {
    await awsStorage.createDirectory(path)
  },

  async moveFile(from: string, to: string): Promise<void> {
    await awsStorage.moveFile(from, to)
  },

  async copyFile(from: string, to: string): Promise<void> {
    await awsStorage.copyFile(from, to)
  },

  async stat(path: string): Promise<StatEntry> {
    return await awsStorage.stat(path)
  },

  list(path: string, options: { deep: boolean }): DirectoryListing {
    return awsStorage.list(path, options)
  },

  async changeVisibility(path: string, visibility: string): Promise<void> {
    await awsStorage.changeVisibility(path, visibility)
  },

  async visibility(path: string): Promise<string> {
    return await awsStorage.visibility(path)
  },

  async fileExists(path: string): Promise<boolean> {
    return await awsStorage.fileExists(path)
  },

  async directoryExists(path: string): Promise<boolean> {
    return await awsStorage.directoryExists(path)
  },

  async publicUrl(path: string, options: PublicUrlOptions): Promise<string> {
    return await awsStorage.publicUrl(path, options)
  },

  async temporaryUrl(path: string, options: TemporaryUrlOptions): Promise<string> {
    return await awsStorage.temporaryUrl(path, options)
  },

  async checksum(path: string, options: ChecksumOptions): Promise<string> {
    return await awsStorage.checksum(path, options)
  },

  async mimeType(path: string, options: MimeTypeOptions): Promise<string> {
    return await awsStorage.mimeType(path, options)
  },

  async lastModified(path: string): Promise<number> {
    return await awsStorage.lastModified(path)
  },

  async fileSize(path: string): Promise<number> {
    return await awsStorage.fileSize(path)
  },

  async read(path: string): Promise<FileContents> {
    const contents = await awsStorage.read(path)

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
