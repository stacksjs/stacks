export * from './copy'
export * from './delete'
export * from './files'
export * from './folders'
export * from './fs'
export * from './glob'
export * from './hash'
export * from './helpers'
export * as storage from './storage'
export * from './zip'

// Storage adapters and types
export * from './adapters'
export * from './types'
export * from './drivers'

// Static asset serving with ETag/Last-Modified/Cache-Control
export { serveFile } from './static-serve'
export type { ServeFileOptions } from './static-serve'

// Laravel-style Storage facade and UploadedFile
export { Storage, StorageManager } from './facade'
export type { DiskConfig, FilesystemConfig, LocalDiskConfig, S3DiskConfig } from './facade'
export type { FilenameStrategy, PutFileOptions, UploadedFileLike } from './put-file'
export { UploadedFile, uploadedFile, uploadedFiles } from './uploaded-file'

// Filesystem type helpers
export { configFromEnv, localDisk, s3Disk } from './types/filesystem'
// Disk-name autocomplete: userland augments `KnownDisks` to get
// completion on `Storage.disk('…')` (stacksjs/stacks#1924).
export type { DiskName, KnownDisks } from './types/filesystem'

// Signed-URL helpers (used by Storage.disk('local').signedUrl())
export {
  clearRevokedSignedStorageTokens,
  createSignedStorageToken,
  isSignedStorageTokenRevoked,
  revokeSignedStorageToken,
  verifySignedStorageToken,
} from './signed-url'
export type { SignedTokenVerification } from './signed-url'
export type { SignedUrlOptions } from './types'

// Path-sanitization helpers (used internally by S3 presignedUploadUrl;
// also re-exported so user code can pre-validate input from request
// bodies and surface 400s with a clean `PathSanitizeError`.)
export { parseDiskPath, PathSanitizeError, sanitizePresignedDir, sanitizePresignedFilename } from './path-sanitize'
export type { ParsedDiskPath } from './path-sanitize'

// MIME re-verification — server-side check that uploaded bytes match
// the claimed content type. Run this after a presigned upload
// completes since `Content-Type` on a presigned PUT is caller-attested.
export { detectMimeFromMagicBytes, verifyUploadedMime } from './mime-verify'
export type { MimeVerifyResult } from './mime-verify'

// S3 presigned-POST policy signer (stacksjs/stacks#1888 Phase B).
// Exposed as a standalone for callers that have their own S3 client
// and just need the policy-signing logic; the Storage facade wraps
// it as `presignedUploadPolicy()`.
export { signS3PresignedPost } from './s3-presigned-post'
export type { S3PresignedPostInput, S3PresignedPostResult } from './s3-presigned-post'
export type {
  GetStreamOptions,
  PresignedUploadPolicy,
  PresignedUploadPolicyOptions,
  PutResult,
  PutStreamOptions,
} from './types'
