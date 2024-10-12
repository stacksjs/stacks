import { resolve } from 'node:path'
import process from 'node:process'
import { FileStorage } from '@flystorage/file-storage'
import { LocalStorageAdapter } from '@flystorage/local-fs'

const rootDirectory = resolve(process.cwd(), 'my-files')
const adapter = new LocalStorageAdapter(rootDirectory)

export const storage: FileStorage = new FileStorage(adapter)
