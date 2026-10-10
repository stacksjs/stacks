# Uploads and disks

Read this for application upload workflows and topology-dependent behavior.
Source root: `storage/framework/core/storage/src/`.

## Facade versus adapter

`Storage` is a manager: put/get/delete/url/copy/move and metadata conveniences
target the configured default disk. `Storage.disk(name)` returns a StorageAdapter,
whose equivalent names are write/readToString/deleteFile/publicUrl/copyFile/
moveFile. It does not return a second facade with put/get methods.

```ts
import { Storage } from '@stacksjs/storage'

const result = await Storage.disk('public').write('exports/report.txt', 'Report')
const publicUrl = await Storage.disk('public').publicUrl(result.path)
```

`write` and facade put return PutResult with path/size and optional provider
metadata. Optional etag/contentType/lastModified values are not synthesized as
proof of an unavailable provider response. `Storage.stat(path)` provides a full
metadata read. `filesystems.driver` names a configured disk: local/public/S3
out of the box, custom names after init/configure. Default is local.

## Server-proxied uploaded files

`Storage.put(file, options?)` accepts UploadedFileLike from a parsed request or
the native UploadedFile wrapper and returns PutResult plus url. Options are disk,
dir, filename strategy (uuid/hash/original/custom), preserveExtension, overwrite
and transform. Default uuid naming avoids leaking client names. overwrite defaults
true, so set an explicit policy for collision-sensitive uploads.

Use the native request file macro, validate the boundary, then pass the file to
storage. Client MIME and file extension are hints. `verifyUploadedMime` and
`detectMimeFromMagicBytes` provide byte checks; read `mime-verify.ts` for supported
formats and result semantics. fileInfo/fileInfoFromBytes/fileKind/isPreviewable/
resolveMime provide native metadata. A transform that changes image format must
also update the output MIME/name policy. The optional image pipeline is under
`@stacksjs/storage/image`, separate from the lightweight public entry.

Source: `put-file.ts`, `uploaded-file.ts`, `mime-verify.ts`, `file-info.ts`.
Evidence: `tests/put-file.test.ts`, `mime-verify.test.ts`, `file-info.test.ts`.

## Direct provider uploads

`presignedUploadUrl({ contentType, expiresIn, dir?, filename?, maxSize? })`
returns a signed PUT destination. `maxSize` is advisory; a browser can ignore it.
The provider signs the exact Content-Type. Authenticate and authorize the
presign action, select the server-owned directory, then verify the uploaded object
before accepting it as the user's record.

For a provider-enforced size cap, use the S3 POST policy API:

```ts
import { Storage } from '@stacksjs/storage'

const policy = await Storage.disk('s3').presignedUploadPolicy({
  key: 'avatars/user-7/avatar.jpg',
  contentType: 'image/jpeg',
  contentLengthRange: { min: 1, max: 2 * 1024 * 1024 },
  expiresIn: 300,
})
```

Submit every policy.fields entry and the file as multipart form data to policy.url.
Local/memory adapters do not implement a remote upload URL; generic facade calls
throw clearly when the optional adapter method is absent. A frontend direct-upload
composable must be imported from its package when it is absent from the actual
STX runtime globals. See stacks-composables and stacks-auto-imports.

Source: `facade.ts`, `types.ts`, `s3-presigned-post.ts`, `adapters/s3.ts`.
Evidence: `tests/s3-presigned-post.test.ts`, `path-sanitize.test.ts`.

## Streams and cross-disk movement

`getStream(path, { signal? })` returns a web ReadableStream; putStream accepts
that stream and optional contentType/signal plus S3 multipart tuning. Local and
Azure reads are incremental; S3 reads currently buffer. S3 writes multipart large
streams; Azure stages blocks and commits the block list. Abort is driver-specific;
read the adapter when planning memory bounds or retries.

`Storage.copyAcross('sourceDisk:path', 'destinationDisk:path')` uses a native
copy for the same disk, otherwise reads then writes buffered content.
moveAcross uses native same-disk movement, or copy then source delete across
disks. A cross-disk delete failure can leave both copies after a successful
destination write; it is not an atomic distributed move. Moving a path onto
itself preserves the file.

Source: `facade.ts`, adapters; evidence: `tests/streaming.test.ts`,
`readable-stream-guard.test.ts`, `move-onto-itself.test.ts`.

## Provider disks and visibility

Native presets: localDisk/s3Disk/azureDisk/r2Disk/gcsDisk/filebaseDisk/
backblazeDisk/hetznerDisk. Read `types/filesystem.ts` for their options and
credentials. S3-compatible providers share the S3 adapter but vary endpoint,
path style, region and public URL. config/filesystems.s3.usePathStyleEndpoint
overrides the endpoint default; virtual-hosted providers need the appropriate
false value. R2's API host is not a public object host.

Local visibility changes POSIX permissions and reads world-readable mode bits;
S3 uses provider ACL calls. Modern bucket-owner-enforced S3 buckets reject object
ACL changes, so use provider policies or signed URLs for those buckets. Public URL
generation is not itself an ACL change. Azure has container-wide visibility and
rejects changeVisibility for one blob. Azure service-SAS generation needs an
account key; a configured SAS token cannot be widened into fresh signed grants.
ensureConfiguredBuckets provisions S3 buckets, not Azure containers.

KnownDisks is an augmentable name registry for completion, not runtime
configuration. Declare the disk and configure it as well. Provider evidence
is recorded in `core/config/src/capabilities.ts`; partial live-provider evidence
is not upgraded by a preset or TypeScript type.

Evidence: `tests/default-disk.test.ts`, `config-path-style.test.ts`,
`s3-compatible-disks.test.ts`, `visibility.test.ts`, `s3-visibility.test.ts`,
`azure-adapter.test.ts` and `azure-signing.test.ts`.

## Signed links and tenant scopes

`signedUrl(path, { expiresIn, ... })` grants temporary access; local signed links
use APP_KEY and the native storage-serving route, while providers use their
own signed URL mechanism. Verify the actual route/adapter and disk claim rather
than serving an arbitrary client-supplied path. PublicUrl and signedUrl have
different access guarantees.

`scoped(Storage.disk(name), { scope: tenantId })` wraps an adapter with a validated
path prefix and tenant-relative listing/metadata. Derive tenantId from authenticated
authority. The wrapper protects path scope, not a caller's right to choose the
tenant. Underlying optional methods still need driver support.

Source: `signed-url.ts`, `static-serve.ts`, `adapters/scoped.ts`; evidence:
`tests/scoped.test.ts`, `static-serve.test.ts`, `path-sanitize.test.ts`.
