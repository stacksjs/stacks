import type { StorageDriver } from '@stacksjs/types'
import type { StorageAdapter } from '../types'
import { createS3Storage } from '../adapters/s3'

let _adapterPromise: Promise<StorageAdapter> | null = null

// Pass `null` as the client — S3StorageAdapter builds it lazily from the
// region on first use, so `@stacksjs/ts-cloud` only loads when S3 is
// actually touched (not at storage import time).
async function loadConfig(): Promise<StorageAdapter> {
  try {
    const { filesystems } = await import('@stacksjs/config')
    const s3Config = filesystems.s3

    return createS3Storage(null, {
      bucket: s3Config?.bucket || 'stacks',
      prefix: s3Config?.prefix || 'stx',
      region: s3Config?.region || 'us-east-1',
      // The adapter has always understood these; this loader used to drop
      // them, which quietly pinned the driver to AWS. Without `endpoint` an
      // S3-compatible provider (Hetzner, R2, B2, MinIO) is unreachable, and
      // without `credentials` an explicitly configured key pair was ignored in
      // favour of whatever ambient AWS credentials the process happened to
      // have.
      endpoint: s3Config?.endpoint,
      usePathStyleEndpoint: s3Config?.usePathStyleEndpoint,
      credentials: s3Config?.credentials,
    })
  }
  catch {
    // Config not available, use defaults from env
    const { env } = await import('@stacksjs/env')

    return createS3Storage(null, {
      bucket: env.AWS_S3_BUCKET || 'stacks',
      prefix: env.AWS_S3_PREFIX || 'stx',
      region: env.AWS_REGION || 'us-east-1',
      // `env` values widen to `string | number | true`, so `|| undefined` alone
      // leaves the non-string cases in the type. An endpoint is a URL either way.
      endpoint: env.AWS_ENDPOINT ? String(env.AWS_ENDPOINT) : undefined,
      usePathStyleEndpoint: env.AWS_USE_PATH_STYLE_ENDPOINT === true,
      credentials: env.AWS_ACCESS_KEY_ID && env.AWS_SECRET_ACCESS_KEY
        ? {
            accessKeyId: env.AWS_ACCESS_KEY_ID,
            secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
          }
        : undefined,
    })
  }
}

async function getAdapter(): Promise<StorageAdapter> {
  if (!_adapterPromise) {
    _adapterPromise = loadConfig()
  }
  return _adapterPromise
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
