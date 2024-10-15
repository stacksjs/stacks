import type { ChecksumOptions, DirectoryListing, FileContents, MimeTypeOptions, PublicUrlOptions, StatEntry, TemporaryUrlOptions } from '@flystorage/file-storage'
import { awsStorage } from './aws'
import { localStorage } from './local'
import { memoryStorage } from './memory'

// TODO: get the driver from config
const driver = 'local'

const storage = getStorage()

function getStorage() {
  if (driver === 'local')
    return localStorage

  if (driver === 's3')
    return awsStorage

  if (driver === 'memory')
    return memoryStorage

  return localStorage
}

export async function write(path: string, contents: FileContents): Promise<void> {
  await storage.write(path, contents)
}

export async function deleteFile(path: string): Promise<void> {
  await storage.deleteFile(path)
}

export async function createDirectory(path: string): Promise<void> {
  await storage.createDirectory(path)
}

export async function moveFile(from: string, to: string): Promise<void> {
  await storage.moveFile(from, to)
}

export async function copyFile(from: string, to: string): Promise<void> {
  await storage.copyFile(from, to)
}

export async function stat(path: string): Promise<StatEntry> {
  return await storage.stat(path)
}

export function list(path: string, options: { deep: boolean }): DirectoryListing {
  return storage.list(path, options)
}

export async function changeVisibility(path: string, visibility: string): Promise<void> {
  await storage.changeVisibility(path, visibility)
}

export async function visibility(path: string): Promise<string> {
  return await storage.visibility(path)
}

export async function fileExists(path: string): Promise<boolean> {
  return await storage.fileExists(path)
}

export async function directoryExists(path: string): Promise<boolean> {
  return await storage.directoryExists(path)
}

export async function publicUrl(path: string, options: PublicUrlOptions): Promise<string> {
  return await storage.publicUrl(path, options)
}

export async function temporaryUrl(path: string, options: TemporaryUrlOptions): Promise<string> {
  return await storage.temporaryUrl(path, options)
}

export async function checksum(path: string, options: ChecksumOptions): Promise<string> {
  return await storage.checksum(path, options)
}

export async function mimeType(path: string, options: MimeTypeOptions): Promise<string> {
  return await storage.mimeType(path, options)
}

export async function lastModified(path: string): Promise<number> {
  return await storage.lastModified(path)
}

export async function fileSize(path: string): Promise<number> {
  return await storage.fileSize(path)
}

export async function read(path: string): Promise<FileContents> {
  const contents = await storage.read(path)

  return contents
}
