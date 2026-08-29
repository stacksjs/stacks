---
title: "Storage skill"
description: "Use when working with file storage in Stacks."
---
# Storage

`stacks-storage` · Backend and API · model-invoked

Files, local or on S3, behind one `Storage` facade: put, get, delete, copy, move
and list, plus uploads, visibility, checksums, temporary URLs and the disk
configuration.

## When to reach for it

- The Storage facade (put/get/delete/copy/move/list)
- StorageAdapter interface
- Local and S3 disk configurations
- File uploads (UploadedFile class)
- File operations (read/write/copy/move/delete/hash/glob/zip)
- Visibility management
- Checksums
- MIME types
- Temporary URLs
- Filesystem configuration

## Covers

`@stacksjs/storage`, `config/filesystems.ts`.

## Inside the skill

The sections an agent reads once the skill loads.

- Key Paths
- Package Exports
- Storage Facade (StorageManager)
- StorageAdapter Interface
- File Uploads (UploadedFile)
- Low-Level File Operations
- Types
- Config Helpers
- config/filesystems.ts
- Gotchas

## Where the code lives

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

## Using it

This one is **model-invoked**. Your agent reaches for it on its own when the task
matches, and you can also call it by name:

```
/stacks-storage
```

Source: [`stacks-storage/SKILL.md`](https://github.com/stacksjs/stacks/blob/main/storage/framework/defaults/ai/skills/stacks-storage/SKILL.md).
Shadow it for one project with `app/Skills/stacks-storage/SKILL.md`, then re-run
`buddy setup:ai`. See [Writing your own](/skills/writing).
