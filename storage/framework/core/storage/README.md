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
