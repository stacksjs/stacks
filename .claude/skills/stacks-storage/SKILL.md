---
name: stacks-storage
description: Use when working with file storage in Stacks — the Storage facade (put/get/delete/copy/move/list), StorageAdapter interface, local and S3 disk configurations, file uploads (UploadedFile class), file operations (read/write/copy/move/delete/hash/glob/zip), visibility management, checksums, MIME types, temporary URLs, or filesystem configuration. Covers @stacksjs/storage and config/filesystems.ts.
license: MIT
compatibility: Bun >= 1.3.0, TypeScript
allowed-tools: Read Edit Write Bash Grep Glob
---

# Stacks Storage

File system abstraction with a Laravel-style Storage facade, local/S3 adapters, file upload handling, and low-level file utilities.

## Key Paths
- Core package: `storage/framework/core/storage/src/`
- Storage facade: `storage/framework/core/storage/src/facade.ts`
- Uploaded file: `storage/framework/core/storage/src/uploaded-file.ts`
- Types: `storage/framework/core/storage/src/types.ts`
- Filesystem config types: `storage/framework/core/storage/src/types/filesystem.ts`
- Local adapter: `storage/framework/core/storage/src/adapters/local.ts`
- S3 adapter: `storage/framework/core/storage/src/adapters/s3.ts`
- Memory adapter: `storage/framework/core/storage/src/adapters/memory.ts`
- Bun adapter: `storage/framework/core/storage/src/adapters/bun.ts`
- File utilities: `storage/framework/core/storage/src/files.ts`
- Folder utilities: `storage/framework/core/storage/src/folders.ts`
- Copy: `storage/framework/core/storage/src/copy.ts`
- Move: `storage/framework/core/storage/src/move.ts`
- Delete: `storage/framework/core/storage/src/delete.ts`
- Hash: `storage/framework/core/storage/src/hash.ts`
- Glob: `storage/framework/core/storage/src/glob.ts`
- Zip: `storage/framework/core/storage/src/zip.ts`
- Helpers: `storage/framework/core/storage/src/helpers.ts`
- Configuration: `config/filesystems.ts`

## Package Exports

```typescript
// Storage facade (Laravel-style)
import { Storage, StorageManager } from '@stacksjs/storage'

// File uploads
import { UploadedFile, uploadedFile, uploadedFiles } from '@stacksjs/storage'

// Adapters
import { createLocalStorage, LocalStorageAdapter } from '@stacksjs/storage'
import { createS3Storage, S3StorageAdapter } from '@stacksjs/storage'

// Config helpers
import { localDisk, s3Disk, configFromEnv } from '@stacksjs/storage'

// Types
import type { StorageAdapter, FileContents, StatEntry, DirectoryEntry, DirectoryListing } from '@stacksjs/storage'
import type { ListOptions, PublicUrlOptions, TemporaryUrlOptions, ChecksumOptions, MimeTypeOptions } from '@stacksjs/storage'
import type { DiskConfig, FilesystemConfig, LocalDiskConfig, S3DiskConfig } from '@stacksjs/storage'
import { Visibility, createDirectoryListing, normalizeExpiryToMilliseconds, normalizeExpiryToDate, isFile, isDirectory } from '@stacksjs/storage'

// Low-level file operations
import { copy, copyFile, copyFolder } from '@stacksjs/storage'
import { move, rename } from '@stacksjs/storage'
import { del, deleteFile, deleteFolder, deleteEmptyFolder, deleteEmptyFolders, deleteGlob, isDirectoryEmpty } from '@stacksjs/storage'
import { readJsonFile, readPackageJson, readTextFile, writeFile, writeJsonFile, writeTextFile, put, get, getFiles, deleteFiles, hasFiles } from '@stacksjs/storage'
import { isFolder, isDir, doesFolderExist, createFolder, getFolders } from '@stacksjs/storage'
import { glob, globSync } from '@stacksjs/storage'
import { hashDirectory, hashPath, hashPaths } from '@stacksjs/storage'
import { zip, unzip, archive, unarchive, compress, decompress, gzipSync, gunzipSync, deflateSync, inflateSync } from '@stacksjs/storage'
import * as storage from '@stacksjs/storage'
```

## Storage Facade (StorageManager)

The `Storage` singleton is a pre-instantiated `StorageManager`. It lazily builds its config from `@stacksjs/config` (which reads `config/filesystems.ts` and env vars).

### Basic Operations

```typescript
import { Storage } from '@stacksjs/storage'

// Write a file (to default disk)
await Storage.put('file.txt', 'Hello World')
await Storage.put('data.bin', new Uint8Array([1, 2, 3]))

// Read a file as string
const content = await Storage.get('file.txt')

// Check existence
const exists = await Storage.exists('file.txt')
const missing = await Storage.missing('file.txt')

// Delete
await Storage.delete('file.txt')

// Copy and move
await Storage.copy('source.txt', 'dest.txt')
await Storage.move('old.txt', 'new.txt')

// File info
const size = await Storage.size('file.txt')          // bytes
const modified = await Storage.lastModified('file.txt')  // ms timestamp
const mime = await Storage.mimeType('file.txt')
const hash = await Storage.checksum('file.txt', 'sha256')  // 'md5' | 'sha1' | 'sha256'

// Public URL
const url = await Storage.url('file.txt')

// Directories
await Storage.makeDirectory('uploads/images')
await Storage.deleteDirectory('uploads/old')

// List files (returns AsyncIterable<{ path, type }>)
for await (const entry of Storage.files('uploads/')) {
  console.log(entry.path, entry.type)  // 'file' or 'directory'
}

// Recursive listing
for await (const entry of Storage.allFiles('uploads/')) {
  console.log(entry.path)
}
```

### Using Named Disks

```typescript
// Use a specific disk
await Storage.disk('s3').write('uploads/file.txt', contents)
await Storage.disk('public').write('images/logo.png', imageData)
await Storage.disk('local').readToString('config.json')

// Disk instances are cached -- subsequent calls return the same adapter
```

### Configuring Disks

```typescript
// Initialize with custom config (overrides env-based config)
Storage.init({
  default: 's3',
  disks: {
    custom: { driver: 'local', root: '/custom/path' },
  },
})

// Add/update a disk at runtime
Storage.configure('backups', { driver: 's3', bucket: 'my-backups', region: 'eu-west-1' })

// Change default disk
Storage.setDefaultDisk('s3')

// Query configuration
Storage.getDefaultDisk()           // 'local'
Storage.getConfiguredDisks()       // ['local', 'public', 's3']
Storage.getDiskConfig('s3')        // S3DiskConfig object

// Reset all caches (useful for testing)
Storage.reset()
```

### Built-in Disk Configurations

The facade auto-configures these disks from `config/filesystems.ts`:

- **`local`** -- `driver: 'local'`, root: `<project>/storage/app`, visibility: from config (default `'private'`)
- **`public`** -- `driver: 'local'`, root: `<project>/public`, url: `<appUrl>/storage`, visibility: `'public'`
- **`s3`** -- only added if `s3.bucket` is configured in filesystems config

## StorageAdapter Interface

All adapters implement this interface:

```typescript
interface StorageAdapter {
  write(path: string, contents: FileContents): Promise<void>
  read(path: string): Promise<FileContents>
  readToString(path: string): Promise<string>
  readToBuffer(path: string): Promise<Buffer>
  readToUint8Array(path: string): Promise<Uint8Array>
  deleteFile(path: string): Promise<void>
  deleteDirectory(path: string): Promise<void>
  createDirectory(path: string): Promise<void>
  moveFile(from: string, to: string): Promise<void>
  copyFile(from: string, to: string): Promise<void>
  stat(path: string): Promise<StatEntry>
  list(path: string, options?: ListOptions): DirectoryListing  // AsyncIterable
  changeVisibility(path: string, visibility: Visibility): Promise<void>
  visibility(path: string): Promise<Visibility>
  fileExists(path: string): Promise<boolean>
  directoryExists(path: string): Promise<boolean>
  publicUrl(path: string, options?: PublicUrlOptions): Promise<string>
  temporaryUrl(path: string, options: TemporaryUrlOptions): Promise<string>
  checksum(path: string, options?: ChecksumOptions): Promise<string>
  mimeType(path: string, options?: MimeTypeOptions): Promise<string>
  lastModified(path: string): Promise<number>
  fileSize(path: string): Promise<number>
}
```

### Local Adapter (`LocalStorageAdapter`)

```typescript
import { createLocalStorage } from '@stacksjs/storage'

const local = createLocalStorage({ root: './storage' })
```

- Uses Node.js `fs/promises` for file operations
- Path traversal protection: throws if resolved path escapes the root directory
- `write()` auto-creates parent directories with `mkdir({ recursive: true })`
- `moveFile()` uses `fs.rename()`; `copyFile()` uses `fs.copyFile()`
- `checksum()` uses `Bun.CryptoHasher` (default algorithm: `sha256`)
- `temporaryUrl()` generates HMAC-signed URLs using `APP_KEY` env var
- `changeVisibility()` is a no-op (Node.js doesn't map to public/private simply)
- `visibility()` always returns `'private'`
- MIME type detection is extension-based (supports txt, html, css, js, json, xml, pdf, zip, jpg, jpeg, png, gif, svg, mp4, mp3, wav)
- `list()` returns an async iterable; supports `deep: true` for recursive listing

### S3 Adapter (`S3StorageAdapter`)

```typescript
import { createS3Storage, S3StorageAdapter } from '@stacksjs/storage'
import { S3Client } from '@stacksjs/ts-cloud'

const client = new S3Client('us-east-1')
const s3 = new S3StorageAdapter(client, { bucket: 'my-bucket', region: 'us-east-1', prefix: 'uploads/' })
```

- Uses `@stacksjs/ts-cloud` S3Client for AWS operations
- Supports key prefix: all paths are prefixed with `config.prefix`
- `write()` auto-detects MIME type from extension and sets `contentType`
- `createDirectory()` is a no-op (S3 directories are implicit)
- `moveFile()` = `copyFile()` + `deleteFile()`
- `deleteDirectory()` lists all objects with prefix and deletes them in bulk
- `temporaryUrl()` uses `client.getSignedUrl()` for pre-signed URLs
- `checksum()` downloads the file content and hashes with `Bun.CryptoHasher`
- `publicUrl()` defaults to `https://<bucket>.s3.<region>.amazonaws.com/<key>`
- `list()` supports pagination via continuation tokens; `deep: true` uses `listAllObjects()`
- `fileExists()` uses `headObject()` and catches 404/NoSuchKey/NotFound errors

## File Uploads (UploadedFile)

```typescript
import { UploadedFile, uploadedFile, uploadedFiles } from '@stacksjs/storage'

// Create from native File object
const file = uploadedFile(nativeFile)
const files = uploadedFiles([file1, file2])

// Properties
file.name          // original filename
file.extension     // lowercase extension without dot
file.mimeType      // client MIME type
file.size          // size in bytes
file.file          // underlying File object

// Content access
const buffer = await file.arrayBuffer()
const bytes = await file.bytes()       // Uint8Array
const text = await file.text()

// Validation
file.isValid()     // size > 0
file.isImage()     // MIME starts with 'image/'
file.isVideo()     // MIME starts with 'video/'
file.isAudio()     // MIME starts with 'audio/'
file.isPdf()       // MIME is 'application/pdf'
file.isOneOf(['image/*', 'application/pdf'])  // wildcard match

// Name helpers
file.hashName()                    // UUID-based hash filename: 'a1b2c3d4...f5.jpg'
file.hashName('png')               // override extension: 'a1b2c3d4...f5.png'
file.getClientOriginalName()       // filename without extension
file.getClientOriginalExtension()  // same as .extension
file.getClientMimeType()           // same as .mimeType
file.getSize()                     // human-readable: '1.50 MB'

// Store to disk
const path = await file.store('uploads/avatars')            // default disk: 'local', hash name
const path = await file.store('uploads/', 's3')              // specify disk
const path = await file.storeAs('uploads/', 'avatar.jpg')    // specific name, 'local' disk
const path = await file.storeAs('uploads/', 'pic.jpg', 's3') // specific name, specific disk
const path = await file.storePublicly('images/')              // stores to 'public' disk
const path = await file.storePubliclyAs('images/', 'logo.png')

// Move (write to new location)
const path = await file.move('new/path/file.jpg', 'local')
```

`store()` generates a hash-based filename using `crypto.randomUUID()`. `storeAs()` validates the filename: rejects path traversal (`..`), forward slashes, and backslashes.

## Low-Level File Operations

### Read/Write Files

```typescript
import { readJsonFile, readTextFile, readPackageJson, writeFile, writeJsonFile, writeTextFile, put, get } from '@stacksjs/storage'

// JSON files (auto-detects indent and newline style)
const jsonFile = await readJsonFile('package.json')
// Returns { path, data (parsed), indent, newline }
await writeJsonFile(jsonFile)  // preserves formatting

// Package.json helper
const pkg = await readPackageJson('package.json')

// Text files
const textFile = await readTextFile('config.txt')
// Returns { path, data (string) }
await writeTextFile({ path: 'out.txt', data: 'content' })

// Bun.write shorthand
const bytes = await writeFile('output.txt', 'data')  // returns bytes written

// Simple put/get
put('file.txt', 'contents')          // sync write, auto-creates dirs
const content = await get('file.txt') // async read via Bun.file().text()
```

### Copy

```typescript
import { copy, copyFile, copyFolder } from '@stacksjs/storage'

copy('src.txt', 'dest.txt')                   // single file
copy(['a.txt', 'b.txt'], 'dest/')             // multiple files
copy('srcDir/', 'destDir/')                    // directory (recursive)
copy('srcDir/', 'destDir/', ['node_modules'])  // with exclusions
copyFile('src.txt', 'dest.txt')                // single file only
copyFolder('srcDir/', 'destDir/', ['dist'])     // directory with exclusions
```

### Move/Rename

```typescript
import { move, rename } from '@stacksjs/storage'

const result = await move('old.txt', 'new.txt')                    // single file
const result = await move(['a.txt', 'b.txt'], 'dest/')             // multiple files to directory
const result = await move('old.txt', 'new.txt', { overwrite: true })

const result = await rename('old.txt', 'new.txt')
// Returns Result<{ message: string }, Error>
```

`move()` creates destination directories if needed. Without `overwrite: true`, throws if destination exists.

### Delete

```typescript
import { del, deleteFile, deleteFolder, deleteEmptyFolder, deleteEmptyFolders, deleteGlob, isDirectoryEmpty } from '@stacksjs/storage'

await del('path')                // auto-detects: file, folder, or glob
await deleteFile('file.txt')     // file only
await deleteFolder('dir/')       // recursive delete
await deleteEmptyFolder('dir/')  // only if empty
await deleteEmptyFolders('parent/')  // recursively delete all empty subdirs
await deleteGlob('dist/*')      // delete matching directories

const result = await isDirectoryEmpty('dir/')  // Result<boolean, Error>
```

All delete functions return `Result<string, Error>` using `@stacksjs/error-handling`.

### Glob

```typescript
import { glob, globSync } from '@stacksjs/storage'

const files = await glob('**/*.ts')
const files = await glob(['src/**/*.ts', 'tests/**/*.ts'])
const files = await glob('**/*.ts', {
  cwd: '/project',
  absolute: true,
  dot: true,         // include dotfiles
  onlyFiles: true,
})

// Sync version
const files = globSync('**/*.ts', { cwd: '/project' })
```

Uses `Bun.Glob` internally.

### Hash

```typescript
import { hashDirectory, hashPath, hashPaths } from '@stacksjs/storage'

const hash = hashDirectory('src/')                    // SHA-256 of all files
const hash = hashPath('src/index.ts')                 // SHA-256 of single file or directory
const hash = hashPaths(['src/', 'tests/'])            // combined SHA-256
const hash = hashPaths('src/index.ts')                // accepts single string too
```

All use `createHash('sha256')` from Node.js crypto.

### Zip/Compression

```typescript
import { zip, unzip, archive, unarchive, compress, decompress } from '@stacksjs/storage'
import { gzipSync, gunzipSync, deflateSync, inflateSync } from '@stacksjs/storage'

// Shell-based zip (via `zip -r` command)
await zip('src/', 'archive.zip')
await zip(['file1.txt', 'file2.txt'], 'archive.zip')
await zip('src/', 'archive.zip', { cwd: '/project' })
await unzip('archive.zip')
await unzip(['a.zip', 'b.zip'])

// Aliases
archive('src/')    // = zip
unarchive('a.zip') // = unzip
compress(['a', 'b'])  // = zip
decompress('a.zip')   // = unzip

// Bun-native compression (synchronous)
const compressed = gzipSync(data)          // Bun.gzipSync
const decompressed = gunzipSync(compressed) // Bun.gunzipSync
const deflated = deflateSync(data)         // Bun.deflateSync
const inflated = inflateSync(deflated)     // Bun.inflateSync
```

### Folder Utilities

```typescript
import { isFolder, isDir, doesFolderExist, createFolder, getFolders } from '@stacksjs/storage'

isFolder('/path')           // boolean, checks fs.statSync().isDirectory()
isDir('/path')              // alias for isFolder
doesFolderExist('/path')    // boolean, checks fs.existsSync()
await createFolder('dir/')  // mkdirSync with recursive: true
const dirs = getFolders('parent/')  // returns subdirectory names
```

### File Query Utilities

```typescript
import { doesExist, doesNotExist, hasFiles, getFiles, deleteFiles } from '@stacksjs/storage'

doesExist('/path')              // file or folder exists
doesNotExist('/path')           // neither file nor folder
hasFiles('dir/')                // directory has any entries
const files = getFiles('dir/')  // all files recursively
const files = getFiles('dir/', ['node_modules'])  // with exclusions
deleteFiles('dir/', ['keep.txt'])  // delete all except exclusions
```

### Config File Helper

```typescript
import { updateConfigFile } from '@stacksjs/storage'

await updateConfigFile('config.json', { key: 'newValue' })
// Reads, merges, writes JSON config file
```

## Types

```typescript
type FileContents = string | Buffer | Uint8Array | ReadableStream

enum Visibility {
  PUBLIC = 'public',
  PRIVATE = 'private',
}

interface StatEntry {
  path: string
  type: 'file' | 'directory'
  visibility: Visibility
  size: number
  lastModified: number        // milliseconds
  mimeType?: string
  metadata?: Record<string, any>
}

interface DirectoryEntry {
  path: string
  type: 'file' | 'directory'
}

interface DirectoryListing extends AsyncIterable<DirectoryEntry> {}

interface ListOptions {
  deep?: boolean
}

interface TemporaryUrlOptions {
  expiresIn: number | Date    // seconds or Date object
}

interface ChecksumOptions {
  algorithm?: 'md5' | 'sha1' | 'sha256'
}

// Filesystem config types
type FilesystemDriver = 'local' | 's3'
type DiskConfig = LocalDiskConfig | S3DiskConfig

interface LocalDiskConfig {
  driver: 'local'
  root: string
  url?: string
  visibility?: 'public' | 'private'
}

interface S3DiskConfig {
  driver: 's3'
  bucket: string
  region?: string
  prefix?: string
  endpoint?: string
  usePathStyleEndpoint?: boolean
  url?: string
  credentials?: { key: string; secret: string }
  visibility?: 'public' | 'private'
}

interface FilesystemConfig {
  default: string
  disks: Record<string, DiskConfig>
}
```

## Config Helpers

```typescript
import { localDisk, s3Disk, configFromEnv } from '@stacksjs/storage'

// Create a local disk config
const disk = localDisk('/storage/app', { visibility: 'public', url: '/storage' })

// Create an S3 disk config (region defaults to AWS_DEFAULT_REGION env or 'us-east-1')
const disk = s3Disk('my-bucket', { region: 'eu-west-1', prefix: 'uploads/' })

// Build config from environment variables
// Reads: FILESYSTEM_DISK, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_DEFAULT_REGION, AWS_BUCKET, AWS_ENDPOINT, AWS_URL, AWS_USE_PATH_STYLE_ENDPOINT
const config = configFromEnv({ default: 'local' })
```

## config/filesystems.ts

```typescript
{
  driver: (env.STORAGE_DRIVER || 'bun') as any,  // 'local' | 'bun' | 's3' | 'memory'
  root: env.STORAGE_ROOT || process.cwd(),
  s3: {
    bucket: env.AWS_S3_BUCKET || '',
    region: env.AWS_REGION || 'us-east-1',
    prefix: env.AWS_S3_PREFIX || '',
    credentials: env.AWS_ACCESS_KEY_ID && env.AWS_SECRET_ACCESS_KEY
      ? { accessKeyId: env.AWS_ACCESS_KEY_ID, secretAccessKey: env.AWS_SECRET_ACCESS_KEY }
      : undefined,
  },
  publicUrl: {
    domain: env.STORAGE_PUBLIC_URL || env.APP_URL || 'http://localhost',
  },
  defaultVisibility: 'private',
} satisfies FilesystemsConfig
```

## Gotchas
- Default driver is `'bun'` (not `'local'`), but the Storage facade only supports `'local'` and `'s3'` drivers -- the `buildConfig()` in the facade maps the filesystems config to `'local'` as the default disk driver
- The `local` disk root is `<project>/storage/app`, not the project root
- The `public` disk root is `<project>/public` with URL prefix `<appUrl>/storage`
- S3 disk is only added if `s3.bucket` is configured
- `list()` returns an `AsyncIterable` -- use `for await` to iterate
- `checksum()` defaults to `sha256` in both adapters (not `md5`)
- `temporaryUrl()` on local adapter generates HMAC-signed URLs using `APP_KEY` env var
- `temporaryUrl()` on S3 adapter uses pre-signed URLs via `getSignedUrl()`
- `LocalStorageAdapter` prevents path traversal -- throws if resolved path escapes the root
- `S3StorageAdapter` requires a bucket name -- throws on construction if missing
- `changeVisibility()` is a no-op on both local and S3 adapters
- `visibility()` always returns `'private'` on both adapters
- The `Storage` singleton is pre-instantiated -- use `Storage.reset()` to clear caches for testing
- `UploadedFile.storeAs()` rejects filenames containing `..`, `/`, or `\` to prevent path traversal
- `UploadedFile.hashName()` is cached -- calling it multiple times returns the same hash
- Low-level operations (`copy`, `move`, `delete*`, etc.) use synchronous `fs` methods, while the Storage facade uses async operations
- `zip()` and `unzip()` shell out to the `zip`/`unzip` commands -- they require these tools to be installed on the system
- `STORAGE_DRIVER` env var controls the driver selection in `config/filesystems.ts`
