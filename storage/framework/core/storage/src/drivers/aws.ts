import type { StorageDriver } from '@stacksjs/types'
import type { StorageAdapter } from '../types'
import { S3Client } from '@aws-sdk/client-s3'
import { createS3Storage } from '../adapters/s3'

let _adapter: StorageAdapter | null = null
let _client: S3Client | null = null
let _configLoaded = false

async function loadConfig() {
  if (_configLoaded) return
  _configLoaded = true

  try {
    const { filesystems } = await import('@stacksjs/config')
    const s3Config = filesystems.s3

    _client = new S3Client({
      region: s3Config?.region || 'us-east-1',
      credentials: s3Config?.credentials
        ? {
            accessKeyId: s3Config.credentials.accessKeyId,
            secretAccessKey: s3Config.credentials.secretAccessKey,
          }
        : undefined,
      endpoint: s3Config?.endpoint,
    })

    _adapter = createS3Storage(_client, {
      bucket: s3Config?.bucket || 'stacks',
      prefix: s3Config?.prefix || 'stx',
      region: s3Config?.region || 'us-east-1',
    })
  }
  catch {
    // Config not available, use defaults from env
    const envVars = typeof Bun !== 'undefined' ? Bun.env : process.env

    _client = new S3Client({
      region: envVars.AWS_REGION || 'us-east-1',
      credentials: envVars.AWS_ACCESS_KEY_ID && envVars.AWS_SECRET_ACCESS_KEY
        ? {
            accessKeyId: envVars.AWS_ACCESS_KEY_ID,
            secretAccessKey: envVars.AWS_SECRET_ACCESS_KEY,
          }
        : undefined,
      endpoint: envVars.AWS_ENDPOINT,
    })

    _adapter = createS3Storage(_client, {
      bucket: envVars.AWS_S3_BUCKET || 'stacks',
      prefix: envVars.AWS_S3_PREFIX || 'stx',
      region: envVars.AWS_REGION || 'us-east-1',
    })
  }
}

async function getAdapter(): Promise<StorageAdapter> {
  await loadConfig()
  return _adapter!
}

export async function getAwsStorage(): Promise<StorageAdapter> {
  return getAdapter()
}

export const aws: StorageDriver = {
  async write(path: string, contents: any): Promise<void> {
    const adapter = await getAdapter()
    await adapter.write(path, contents)
  },

  async deleteFile(path: string): Promise<void> {
    const adapter = await getAdapter()
    await adapter.deleteFile(path)
  },

  async createDirectory(path: string): Promise<void> {
    const adapter = await getAdapter()
    await adapter.createDirectory(path)
  },

  async moveFile(from: string, to: string): Promise<void> {
    const adapter = await getAdapter()
    await adapter.moveFile(from, to)
  },

  async copyFile(from: string, to: string): Promise<void> {
    const adapter = await getAdapter()
    await adapter.copyFile(from, to)
  },

  async stat(path: string) {
    const adapter = await getAdapter()
    return await adapter.stat(path)
  },

  list(path: string, options: { deep: boolean } = { deep: false }) {
    // For list, we need to handle this differently since it returns an async iterable
    // We'll create an async generator that loads config first
    return (async function* () {
      const adapter = await getAdapter()
      yield* adapter.list(path, options)
    })() as any
  },

  async changeVisibility(path: string, visibility: any): Promise<void> {
    const adapter = await getAdapter()
    await adapter.changeVisibility(path, visibility)
  },

  async visibility(path: string) {
    const adapter = await getAdapter()
    return await adapter.visibility(path)
  },

  async fileExists(path: string): Promise<boolean> {
    const adapter = await getAdapter()
    return await adapter.fileExists(path)
  },

  async directoryExists(path: string): Promise<boolean> {
    const adapter = await getAdapter()
    return await adapter.directoryExists(path)
  },

  async publicUrl(path: string, options: any) {
    const adapter = await getAdapter()
    return await adapter.publicUrl(path, options)
  },

  async temporaryUrl(path: string, options: any) {
    const adapter = await getAdapter()
    return await adapter.temporaryUrl(path, options)
  },

  async checksum(path: string, options: any) {
    const adapter = await getAdapter()
    return await adapter.checksum(path, options)
  },

  async mimeType(path: string, options: any) {
    const adapter = await getAdapter()
    return await adapter.mimeType(path, options)
  },

  async lastModified(path: string): Promise<number> {
    const adapter = await getAdapter()
    return await adapter.lastModified(path)
  },

  async fileSize(path: string): Promise<number> {
    const adapter = await getAdapter()
    return await adapter.fileSize(path)
  },

  async read(path: string) {
    const adapter = await getAdapter()
    return await adapter.read(path)
  },

  async readToString(path: string): Promise<string> {
    const adapter = await getAdapter()
    return await adapter.readToString(path)
  },

  async readToBuffer(path: string) {
    const adapter = await getAdapter()
    return await adapter.readToBuffer(path)
  },

  async readToUint8Array(path: string): Promise<Uint8Array> {
    const adapter = await getAdapter()
    return await adapter.readToUint8Array(path)
  },
}
