---
title: "Storage skill"
description: "Use when working with file storage in Stacks - the Storage facade (put/get/delete/copy/move/list), StorageAdapter interface, local and S3 disk configurations, file uploads (UploadedFile class), file operations (read/write/copy/move/delete/hash/glob/zip), visibility management, checksums, MIME types, temporary URLs, or filesystem configuration. Covers @stacksjs/storage and config/filesystems.ts."
---
# Storage

`stacks-storage` · Native Stacks · model-invoked

Use when working with file storage in Stacks - the Storage facade (put/get/delete/copy/move/list), StorageAdapter interface, local and S3 disk configurations, file uploads (UploadedFile class), file operations (read/write/copy/move/delete/hash/glob/zip), visibility management, checksums, MIME types, temporary URLs, or filesystem configuration. Covers @stacksjs/storage and config/filesystems.ts.

Read the skill for the implementation workflow and its current signatures. The
[Native capabilities](/skills/platform/native) catalog maps the package to
source and retained evidence; driver limits are explicit.

## Inside the skill

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
- Upload, stream and signed-link workflows
- Provider evidence

## Supporting references

- [UPLOADS-AND-DISKS.md](https://github.com/stacksjs/stacks/blob/main/storage/framework/defaults/ai/skills/stacks-storage/UPLOADS-AND-DISKS.md)

## Using it

This skill is **model-invoked**. Your agent can select it for matching tasks, and you can call it directly.

```text
/stacks-storage
```

Source: [`stacks-storage/SKILL.md`](https://github.com/stacksjs/stacks/blob/main/storage/framework/defaults/ai/skills/stacks-storage/SKILL.md).

It ships in `@stacksjs/defaults` with its supporting files. Run
`buddy setup:ai` to refresh the agent setup. Override it per project with
`app/Skills/stacks-storage/SKILL.md`. See [Using skills](/skills/using).
