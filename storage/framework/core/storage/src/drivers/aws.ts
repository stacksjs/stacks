import type { StorageDriver } from '@stacksjs/types'
import { S3Client } from '@aws-sdk/client-s3'
import { createS3Storage } from '../adapters/s3'

const client = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
    ? {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      }
    : undefined,
})

const adapter = createS3Storage(client, {
  bucket: process.env.AWS_S3_BUCKET || 'stacks',
  prefix: process.env.AWS_S3_PREFIX || 'stx',
  region: process.env.AWS_REGION || 'us-east-1',
})

export const awsStorage = adapter

export const aws: StorageDriver = {
  async write(path: string, contents: any): Promise<void> {
    await adapter.write(path, contents)
  },

  async deleteFile(path: string): Promise<void> {
    await adapter.deleteFile(path)
  },

  async createDirectory(path: string): Promise<void> {
    await adapter.createDirectory(path)
  },

  async moveFile(from: string, to: string): Promise<void> {
    await adapter.moveFile(from, to)
  },

  async copyFile(from: string, to: string): Promise<void> {
    await adapter.copyFile(from, to)
  },

  async stat(path: string) {
    return await adapter.stat(path)
  },

  list(path: string, options: { deep: boolean } = { deep: false }) {
    return adapter.list(path, options)
  },

  async changeVisibility(path: string, visibility: any): Promise<void> {
    await adapter.changeVisibility(path, visibility)
  },

  async visibility(path: string) {
    return await adapter.visibility(path)
  },

  async fileExists(path: string): Promise<boolean> {
    return await adapter.fileExists(path)
  },

  async directoryExists(path: string): Promise<boolean> {
    return await adapter.directoryExists(path)
  },

  async publicUrl(path: string, options: any) {
    return await adapter.publicUrl(path, options)
  },

  async temporaryUrl(path: string, options: any) {
    return await adapter.temporaryUrl(path, options)
  },

  async checksum(path: string, options: any) {
    return await adapter.checksum(path, options)
  },

  async mimeType(path: string, options: any) {
    return await adapter.mimeType(path, options)
  },

  async lastModified(path: string): Promise<number> {
    return await adapter.lastModified(path)
  },

  async fileSize(path: string): Promise<number> {
    return await adapter.fileSize(path)
  },

  async read(path: string) {
    return await adapter.read(path)
  },

  async readToString(path: string): Promise<string> {
    return await adapter.readToString(path)
  },

  async readToBuffer(path: string) {
    return await adapter.readToBuffer(path)
  },

  async readToUint8Array(path: string): Promise<Uint8Array> {
    return await adapter.readToUint8Array(path)
  },
}
