export * from './cloud'

/**
 * The config types, re-exported from ts-cloud.
 *
 * `config/cloud.ts` is typed by `CloudConfig`, and an application writing that
 * file should not have to know that the shape lives one package over -
 * `@stacksjs/cloud` is the package it configures. Documented as coming from
 * here for a long time before it did (stacksjs/stacks#2581).
 */
export type { CloudConfig, EnvironmentType, InfrastructureConfig } from '@stacksjs/ts-cloud'
export * from './helpers'
export type * from './types'

/**
 * The hand-rolled AWS clients.
 *
 * Exported because `@stacksjs/buddy`'s mail commands need them and this package
 * builds to one bundled `dist/index.js`: a `@stacksjs/cloud/imap/s3` subpath
 * resolves, per the `./*` export, to a `dist/imap/s3.js` that the build never
 * writes. Reaching them by relative path instead is what those commands used to
 * do, and it only ever worked inside this repository.
 */
export * from './imap/client'
export * from './imap/secrets-manager'
export * from './imap/smtp-server'

/**
 * ts-cloud's S3 client, under the name this package has always exported.
 *
 * This used to be a vendored copy (`imap/s3.ts`) that drifted: its bucket
 * configuration getters read `result.<RootElement>` from a parser that strips
 * the root, so `getBucketVersioning`, `getBucketCors`, `getPublicAccessBlock`
 * and the rest returned undefined for configured buckets, and
 * `getBucketLocation` always said us-east-1. ts-cloud fixed that and is a
 * superset of the copy, so the copy is gone and the export points upstream.
 */
export { S3Client } from '@stacksjs/ts-cloud'
export type { S3CopyOptions, S3ListOptions, S3Object, S3SyncOptions } from '@stacksjs/ts-cloud'
