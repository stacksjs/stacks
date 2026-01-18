# Storage Package

A Laravel-style file storage abstraction supporting local filesystem and cloud storage (S3) with a unified API.

## Installation

```bash
bun add @stacksjs/storage
```

## Basic Usage

```typescript
import { Storage } from '@stacksjs/storage'

// Write a file
await Storage.put('documents/report.txt', 'Report content')

// Read a file
const content = await Storage.get('documents/report.txt')

// Check if file exists
const exists = await Storage.exists('documents/report.txt')

// Delete a file
await Storage.delete('documents/report.txt')
```

## Configuration

Configure storage in `config/filesystems.ts`:

```typescript
export default {
  // Default disk
  driver: 'local',

  // Root directory for local storage
  root: process.cwd(),

  // Default file visibility
  defaultVisibility: 'private',

  // S3 configuration
  s3: {
    bucket: process.env.AWS_BUCKET,
    region: process.env.AWS_DEFAULT_REGION || 'us-east-1',
    prefix: '', // Optional path prefix
    endpoint: process.env.AWS_ENDPOINT, // For S3-compatible services
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
  },

  // Public URL configuration
  publicUrl: {
    domain: process.env.ASSET_URL,
  },
}
```

## Working with Disks

### Available Disks

By default, three disks are configured:

- `local`: Private storage in `storage/app`
- `public`: Web-accessible storage in `public`
- `s3`: Amazon S3 or compatible service

### Switching Disks

```typescript
import { Storage } from '@stacksjs/storage'

// Use local disk (default)
await Storage.put('file.txt', 'content')

// Use public disk
await Storage.disk('public').put('images/logo.png', imageBuffer)

// Use S3 disk
await Storage.disk('s3').put('backups/db.sql', sqlDump)
```

### Configuring Custom Disks

```typescript
import { Storage } from '@stacksjs/storage'

// Add a custom disk at runtime
Storage.configure('backups', {
  driver: 'local',
  root: '/mnt/backups',
  visibility: 'private',
})

// Use custom disk
await Storage.disk('backups').put('daily.tar.gz', archiveData)
```

## File Operations

### Writing Files

```typescript
import { Storage } from '@stacksjs/storage'

// Write string content
await Storage.put('documents/readme.txt', 'Hello World')

// Write buffer
const imageBuffer = await fetch('https://example.com/image.png')
  .then(r => r.arrayBuffer())
await Storage.put('images/photo.png', new Uint8Array(imageBuffer))

// Write with visibility
await Storage.disk('s3').put('reports/q1.pdf', pdfData, {
  visibility: 'public'
})
```

### Reading Files

```typescript
import { Storage } from '@stacksjs/storage'

// Read as string
const content = await Storage.get('documents/readme.txt')

// Read as buffer
const disk = Storage.disk('local')
const buffer = await disk.readToBuffer('images/photo.png')

// Stream large files
const stream = Storage.disk('s3').readStream('videos/large.mp4')
```

### Checking File Existence

```typescript
import { Storage } from '@stacksjs/storage'

// Check if file exists
const exists = await Storage.exists('documents/readme.txt')

// Check if file is missing
const missing = await Storage.missing('documents/readme.txt')

if (missing) {
  await Storage.put('documents/readme.txt', 'Default content')
}
```

### Deleting Files

```typescript
import { Storage } from '@stacksjs/storage'

// Delete single file
await Storage.delete('temp/cache.txt')

// Delete multiple files
await Storage.disk('local').deleteFile('file1.txt')
await Storage.disk('local').deleteFile('file2.txt')
```

### Copying and Moving Files

```typescript
import { Storage } from '@stacksjs/storage'

// Copy file
await Storage.copy('original.txt', 'backup/original.txt')

// Move file
await Storage.move('uploads/temp.txt', 'documents/final.txt')
```

## File Information

### Getting File Metadata

```typescript
import { Storage } from '@stacksjs/storage'

// Get file size in bytes
const size = await Storage.size('documents/report.pdf')

// Get last modified timestamp
const lastModified = await Storage.lastModified('documents/report.pdf')

// Get MIME type
const mimeType = await Storage.mimeType('images/photo.jpg')
// Returns: 'image/jpeg'

// Get file checksum
const md5 = await Storage.checksum('documents/report.pdf', 'md5')
const sha256 = await Storage.checksum('documents/report.pdf', 'sha256')
```

### Getting Public URLs

```typescript
import { Storage } from '@stacksjs/storage'

// Get public URL for a file
const url = await Storage.url('images/logo.png')

// For S3, get temporary signed URL
const disk = Storage.disk('s3')
const signedUrl = await disk.temporaryUrl('private/document.pdf', 3600)
// URL expires in 1 hour
```

## Directory Operations

### Creating Directories

```typescript
import { Storage } from '@stacksjs/storage'

// Create directory
await Storage.makeDirectory('uploads/2024/01')

// Nested directories are created automatically
await Storage.put('deep/nested/path/file.txt', 'content')
```

### Listing Files

```typescript
import { Storage } from '@stacksjs/storage'

// List files in directory (shallow)
for await (const item of Storage.files('documents')) {
  console.log(item.path, item.type) // 'file' or 'directory'
}

// List all files recursively (deep)
for await (const item of Storage.allFiles('documents')) {
  if (item.type === 'file') {
    console.log(item.path)
  }
}
```

### Deleting Directories

```typescript
import { Storage } from '@stacksjs/storage'

// Delete directory and all contents
await Storage.deleteDirectory('temp')
```

## File Uploads

### Handling Uploaded Files

```typescript
import { route } from '@stacksjs/router'

route.post('/upload', async (req) => {
  // Get uploaded file
  const file = req.file('document')

  if (file) {
    // Store with auto-generated name
    const path = await file.store('uploads')
    // Returns: 'uploads/abc123.pdf'

    // Store with custom name
    const customPath = await file.storeAs('uploads', 'report-2024.pdf')
    // Returns: 'uploads/report-2024.pdf'

    // Store on specific disk
    await file.store('uploads', { disk: 's3' })
  }

  return Response.json({ success: true })
})
```

### UploadedFile Methods

```typescript
import { UploadedFile } from '@stacksjs/storage'

route.post('/upload', async (req) => {
  const file = req.file('avatar')

  if (file) {
    // Get file information
    const originalName = file.getClientOriginalName()
    const extension = file.getClientOriginalExtension()
    const mimeType = file.getMimeType()
    const size = file.getSize()

    // Validate file
    if (!['image/jpeg', 'image/png'].includes(mimeType)) {
      return Response.json({ error: 'Invalid file type' }, { status: 400 })
    }

    if (size > 5 * 1024 * 1024) { // 5MB
      return Response.json({ error: 'File too large' }, { status: 400 })
    }

    // Store file
    await file.store('avatars')
  }
})
```

### Multiple File Uploads

```typescript
route.post('/upload-multiple', async (req) => {
  const files = req.getFiles('documents')

  const paths = []
  for (const file of files) {
    const path = await file.store('documents')
    paths.push(path)
  }

  return Response.json({ uploaded: paths })
})
```

## S3 Storage

### Basic S3 Operations

```typescript
import { Storage } from '@stacksjs/storage'

const s3 = Storage.disk('s3')

// Upload to S3
await s3.put('uploads/file.txt', 'content')

// Download from S3
const content = await s3.get('uploads/file.txt')

// Delete from S3
await s3.delete('uploads/file.txt')
```

### S3 with Custom Endpoint

For S3-compatible services like MinIO, DigitalOcean Spaces, or Cloudflare R2:

```typescript
// config/filesystems.ts
export default {
  s3: {
    bucket: 'my-bucket',
    region: 'us-east-1',
    endpoint: 'https://s3.example.com', // Custom endpoint
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY,
      secretAccessKey: process.env.S3_SECRET_KEY,
    },
  },
}
```

### S3 Visibility

```typescript
import { Storage } from '@stacksjs/storage'

const s3 = Storage.disk('s3')

// Upload as public
await s3.put('public/image.jpg', imageData, { visibility: 'public' })

// Upload as private (default)
await s3.put('private/document.pdf', pdfData)

// Get visibility
const visibility = await s3.getVisibility('public/image.jpg')
// Returns: 'public' or 'private'

// Change visibility
await s3.setVisibility('file.txt', 'public')
```

## Storage Adapters

### Using Adapters Directly

```typescript
import { createLocalStorage, S3StorageAdapter } from '@stacksjs/storage'
import { S3Client } from '@aws-sdk/client-s3'

// Create local storage adapter
const local = createLocalStorage({ root: '/data/storage' })
await local.write('file.txt', 'content')
const content = await local.readToString('file.txt')

// Create S3 adapter
const s3Client = new S3Client({ region: 'us-east-1' })
const s3 = new S3StorageAdapter(s3Client, {
  bucket: 'my-bucket',
  region: 'us-east-1',
  prefix: 'app/'
})
```

### Adapter Methods

```typescript
// Common adapter methods
await adapter.write(path, contents)
await adapter.readToString(path)
await adapter.readToBuffer(path)
await adapter.fileExists(path)
await adapter.deleteFile(path)
await adapter.copyFile(from, to)
await adapter.moveFile(from, to)
await adapter.fileSize(path)
await adapter.lastModified(path)
await adapter.mimeType(path)
await adapter.checksum(path, { algorithm: 'md5' })
await adapter.publicUrl(path)
await adapter.createDirectory(path)
await adapter.deleteDirectory(path)
adapter.list(path, { deep: true })
```

## Utility Functions

### File System Helpers

```typescript
import {
  copyFile,
  deleteFile,
  deleteFolder,
  ensureDir,
  fileExists,
  folderExists,
  getFileHash,
  getFileSize,
  glob,
  readFile,
  writeFile,
  zipFolder,
  unzipFile
} from '@stacksjs/storage'

// Check existence
const exists = await fileExists('/path/to/file.txt')
const dirExists = await folderExists('/path/to/dir')

// Read/Write
const content = await readFile('/path/to/file.txt')
await writeFile('/path/to/file.txt', 'content')

// Copy/Delete
await copyFile('/source.txt', '/dest.txt')
await deleteFile('/file.txt')
await deleteFolder('/directory')

// Ensure directory exists
await ensureDir('/path/to/directory')

// File info
const size = await getFileSize('/path/to/file.txt')
const hash = await getFileHash('/path/to/file.txt', 'sha256')

// Glob patterns
const files = await glob('**/*.ts', { cwd: '/src' })

// Compression
await zipFolder('/source/dir', '/archive.zip')
await unzipFile('/archive.zip', '/destination')
```

## Storage Manager

### Manager Methods

```typescript
import { Storage, StorageManager } from '@stacksjs/storage'

// Get configured disks
const disks = Storage.getConfiguredDisks()
// Returns: ['local', 'public', 's3']

// Get default disk name
const defaultDisk = Storage.getDefaultDisk()
// Returns: 'local'

// Set default disk
Storage.setDefaultDisk('s3')

// Get disk configuration
const config = Storage.getDiskConfig('s3')

// Reset manager (useful for testing)
Storage.reset()
```

## Edge Cases

### Handling Large Files

```typescript
import { Storage } from '@stacksjs/storage'

// For large files, use streaming
const disk = Storage.disk('s3')

// Read stream
const readStream = disk.readStream('large-file.zip')

// Write in chunks
const largeData = await fetchLargeData()
await disk.writeStream('output.dat', largeData)
```

### Handling Missing Files

```typescript
import { Storage } from '@stacksjs/storage'

try {
  const content = await Storage.get('nonexistent.txt')
} catch (error) {
  if (error.code === 'ENOENT') {
    console.log('File not found')
  }
}

// Or use exists check
if (await Storage.exists('file.txt')) {
  const content = await Storage.get('file.txt')
}
```

### Handling Concurrent Access

```typescript
import { Storage } from '@stacksjs/storage'
import { CacheLock } from '@stacksjs/cache'

async function updateFile(path: string, updater: (content: string) => string) {
  const lock = new CacheLock(cache, { lockTimeout: 5000 })

  await lock.withLock(`file:${path}`, async () => {
    const content = await Storage.get(path)
    const updated = updater(content)
    await Storage.put(path, updated)
  })
}
```

### Handling Special Characters in Paths

```typescript
import { Storage } from '@stacksjs/storage'

// Paths are automatically normalized
await Storage.put('docs/file with spaces.txt', 'content')
await Storage.put('docs/file-with-unicode-\u00e9.txt', 'content')

// Use URL encoding for problematic characters
const safePath = encodeURIComponent('file#with#hashes.txt')
await Storage.put(`docs/${safePath}`, 'content')
```

## API Reference

### Storage Facade Methods

| Method | Description |
|--------|-------------|
| `disk(name?)` | Get disk instance |
| `put(path, contents)` | Write file |
| `get(path)` | Read file as string |
| `exists(path)` | Check if file exists |
| `missing(path)` | Check if file is missing |
| `delete(path)` | Delete file |
| `copy(from, to)` | Copy file |
| `move(from, to)` | Move file |
| `url(path)` | Get public URL |
| `size(path)` | Get file size |
| `lastModified(path)` | Get modification time |
| `mimeType(path)` | Get MIME type |
| `checksum(path, algo?)` | Get file checksum |
| `makeDirectory(path)` | Create directory |
| `deleteDirectory(path)` | Delete directory |
| `files(path)` | List files (shallow) |
| `allFiles(path)` | List files (deep) |

### Configuration Options

| Option | Type | Description |
|--------|------|-------------|
| `driver` | string | Default disk driver |
| `root` | string | Root directory |
| `defaultVisibility` | string | Default file visibility |
| `s3.bucket` | string | S3 bucket name |
| `s3.region` | string | AWS region |
| `s3.endpoint` | string | Custom S3 endpoint |
| `s3.prefix` | string | Path prefix |
| `s3.credentials` | object | AWS credentials |
