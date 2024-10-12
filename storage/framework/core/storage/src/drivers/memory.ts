import { FileStorage } from '@flystorage/file-storage'
import { InMemoryStorageAdapter } from '@flystorage/in-memory'

const adapter = new InMemoryStorageAdapter()

export const storage: FileStorage = new FileStorage(adapter)
