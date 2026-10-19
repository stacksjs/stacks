# Stacks Storage

This package contains the Stacks File System source.

## ☘️ Features

- Easily create your own cloud storage
- Driver-based architecture
- Local, S3, and memory drivers
- Laravel-like Storage API

### TODO

- [ ] Add Google Cloud Storage driver
- [ ] Add Azure Blob Storage driver

## 🤖 Usage

```bash
bun install -d @stacksjs/storage
```

Now, you can use it in your project:

```js
import {
  _dirname,
  copyFolder,
  deleteEmptyFolders,
  deleteFiles,
  deleteFolder,
  doesFolderExist,
  fileURLToPath,
  hasComponents,
  hasFiles,
  hasFunctions,
  isFile,
  isFolder,
  readJsonFile,
  readTextFile,
  writeJsonFile,
  writeTextFile,
} from '@stacksjs/storage'

// wip
```

To view the full documentation, please visit [<https://stacksjs.com/storag>e](https://stacksjs.com/storage).

## Bounded local text reads

Use the standalone entrypoint for local text supplied by a user or worker:

```ts
import { readBoundedTextFile } from '@stacksjs/storage/bounded-text-file'

const journal = await readBoundedTextFile(inputPath, { maxBytes: 4 * 1024 * 1024 })
```

`maxBytes` is required and counts encoded bytes. It accepts nonnegative integers
below the runtime's `node:buffer` `constants.MAX_LENGTH`. The function checks the
opened descriptor is a regular file and its size fits, then reads at most
`maxBytes + 1` bytes to catch growth. It rejects malformed UTF-8 and always closes
the opened descriptor. A UTF-8 BOM counts toward the limit and is omitted from
the decoded string, following `TextDecoder` behavior.

The final path component cannot be a symlink. Nonblocking opening rejects FIFOs
without waiting for a writer. Platforms without `O_NOFOLLOW` and `O_NONBLOCK`
support fail closed. Parent-directory symlinks are followed; callers still own
path authorization. Concurrent edits are not an atomic content snapshot.

`BoundedTextFileError.code` identifies `NOT_REGULAR_FILE`, `FILE_TOO_LARGE`,
`INVALID_UTF8`, or `UNSUPPORTED_PLATFORM`. Invalid limits throw `RangeError`.
Native filesystem failures propagate unchanged, including `ENOENT` and the
platform's final-symlink error. The function and its types are also exported
from `@stacksjs/storage`. Existing `readTextFile` and disk readers keep their
current behavior.

## Completed local artifacts

Publish a bounded set of files into a new private directory. The completion
manifest becomes visible after data and directory sync barriers:

```ts
import { writeCompletedArtifact } from '@stacksjs/storage/completed-artifact-directory'

const artifact = await writeCompletedArtifact(outputDirectory, [
  { path: 'data/surface.asc', contents: numericSurface },
  { path: 'report.json', contents: reportJson },
], manifestJson)
```

The manifest must be a JSON object. The function validates relative entry paths,
case-insensitive duplicates, file/directory collisions, shared buffers and size
limits before filesystem mutation. It copies byte arrays, including Buffer views,
before awaiting IO. Files are exclusive 0600, directories 0700, and existing
destinations are preserved. Limits are 1,024 files, 128 MiB total and a 16 MiB
manifest. Optional `{ directories: ['images'] }` creates empty directories.

Every file and directory entry receives fsync barriers before a synced pending
manifest receives the exclusive `manifest.json` hard-link name. A partial output
is retained for diagnosis. Parents must be operator controlled; callers own
authorization and domain-schema validation. This is a local-filesystem protocol
requiring hard links and directory fsync, with no storage hardware power-loss
guarantee. It is not an S3/disk-adapter transaction or content authentication.

### Prepare an empty artifact before recording ownership

Use the synchronous prepared API when a caller must durably record the exact
owned empty files before any private payload reaches them:

```ts
import { prepareCompletedArtifactDirectorySync } from '@stacksjs/storage/completed-artifact-directory'

const prepared = prepareCompletedArtifactDirectorySync(newDirectory, [
  { path: 'images/preview.bin', contents: previewBytes },
], manifestJson, { directories: ['empty'] })

// Persist prepared.receipt in the caller's ownership ledger before publication.
// Every registered file is still zero length; manifest.json is absent.
const completed = prepared.publishSync()
```

The root package exports the same function and types. The frozen handle has
only `receipt` and `publishSync`. `PreparedCompletedArtifactReceipt` is deeply
frozen, JSON-serializable metadata: canonical `directory`, resolved original
`lexicalDirectory`, `parent` and `root` identities, `directories`, `files`,
`pendingManifest` and the initially absent `completedManifest` alias path.
`CompletedArtifactIdentity` records canonical `path`, `type`, permission `mode`,
and decimal-string `dev`, `ino`, `uid`, `nlink` and `birthtimeNs` observations.
Each `PreparedCompletedArtifactFile` also records planned final `bytes` and
`sha256`, plus `preparationCtimeNs`. **Planned lengths and hashes do not mean
that bytes have been written. All observed file lengths are zero on return.**
Receipts contain neither payload buffers nor the manifest body. Hashes provide
unsigned consistency metadata, not content authentication.

Preparation validates, accounts and detaches all inputs before filesystem
mutation. Records and lists must contain only declared own data properties;
proxies, getters, holes, custom lists, hidden/symbol aliases and shared memory
are refused without executing caller code. Genuine Uint8Array and Buffer views
are copied at their intrinsic offset and length; overriding their iterator or
buffer/length getters cannot influence the copy. The existing limits remain
1,024 data files, 128 MiB including one manifest, 16 MiB UTF-8 manifest and four
relative path components. Files are exclusive 0600 and owned directories 0700.

The configured parent must already exist, belong to the calling operator and
remain operator controlled. Its canonical path permits normal ancestor aliases
such as Darwin's `/var` to `/private/var`; an existing target is never adopted,
including a final symlink. Empty files and directory entries are synced, and
every descriptor is closed before the handle returns. Parent link count is an
observation: creating a sibling artifact can legitimately change it.

`publishSync()` consumes its live closure before work, even on failure. It
rechecks the parent, owned directory entries, private modes, identities, links
and empty files before payload writes. Writes use checked synchronous loops,
fsync and SHA-256 readback. The synced pending manifest receives the exclusive
completed hard-link alias, with file link counts checked through 1, 2, then 1 as
the pending alias is removed. Publication closes descriptors before reporting
success and releases its retained byte references on success or failure. This
does not claim secure memory erasure. Borrowing the method does not change its
target or single-use state. Serialized receipts cannot recreate a writer.

Errors retain partial state for explicit caller reconciliation. There is no
overwrite option, existing-directory writer, implicit cleanup or public restart
writer. Birth time strengthens replacement detection where the filesystem
supports it; zero means unavailable, and coarse timestamps or inode reuse do
not establish an absolute generation guarantee. Change time is checked only
for the empty preallocation barrier, since legitimate writes and links change
it. Do not treat it as an immutable identity for later deletion.

Both calls block the isolate and run without application callbacks or event-loop
pumping. Byte/file caps bound work, not I/O duration. One local Bun 1.4.3 Darwin
run measured prepare/publication at about 15/30 ms for 32 MiB and 71/43 ms for
1,024 empty data files. These are observations, not latency guarantees. A call
inside a database transaction also holds that transaction while the isolate
blocks; this database-free module does not qualify cross-process database
contention or SQL/filesystem atomicity. The existing `writeCompletedArtifact`
still returns a Promise, snapshots before its first await and performs
asynchronous filesystem I/O.

Real local tests cover metadata barriers, offsets, mutation, input nonexecution,
caps, changed identities/modes/links, symlinks, FIFOs, descriptor closure, and
child termination at empty, payload and pending-manifest windows. They do not
qualify privileged device-node replacement, unsupported filesystems, disk-full
or hardware fault injection, physical power loss, media erasure or uncontrolled
copies. The protocol requires POSIX no-follow/nonblocking/directory opens, hard
links and directory fsync. It assumes an unmodified native runtime and controlled
parents; portable Node APIs do not provide a complete descriptor-relative openat
tree protocol or protection from a hostile administrator, same-user process,
thread or addon. Callers own authorization, SQL fences and process quiescence.

## 🧪 Testing

```bash
bun test
```

## 📈 Changelog

Please see our [releases](https://github.com/stacksjs/stacks/releases) page for more information on what has changed recently.

## 🚜 Contributing

Please review the [Contributing Guide](https://github.com/stacksjs/contributing) for details.

## 🏝 Community

For help, discussion about best practices, or any other conversation that would benefit from being searchable:

[Discussions on GitHub](https://github.com/stacksjs/stacks/discussions)

For casual chit-chat with others using this package:

[Join the Stacks Discord Server](https://stacksjs.com/discord)

## 📄 License

The MIT License (MIT). Please see [LICENSE](https://github.com/stacksjs/stacks/tree/main/LICENSE.md) for more information.

Made with 💙
