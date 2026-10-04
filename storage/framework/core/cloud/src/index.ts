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
 * The mail servers, and the AWS clients `@stacksjs/buddy`'s mail commands use.
 *
 * Exported from here because this package builds to one bundled
 * `dist/index.js`: a `@stacksjs/cloud/imap/s3` subpath resolves, per the `./*`
 * export, to a `dist/imap/s3.js` that the build never writes.
 *
 * The clients are ts-cloud's own, under the names this package has always
 * exported. They used to be vendored copies under `imap/` that drifted: the
 * S3 bucket configuration getters and SES's `getSendQuota` and
 * `getSendStatistics` read `result.<RootElement>` from a parser that strips
 * the root, so each returned undefined, and `getBucketLocation` always said
 * us-east-1. ts-cloud fixed those (0.16.19 and 0.16.20) and took the copies'
 * one local fix, the Secrets Manager `ClientRequestToken` (0.16.21), so the
 * copies are gone. The classes come from the package root, so they are the
 * same classes every other ts-cloud caller gets; only types and the pure
 * `buildQueryParams` helper come from the `./aws` subpath, which is the one
 * place ts-cloud exports them.
 */
export * from './imap/smtp-server'
export { AWSClient, S3Client, SecretsManagerClient } from '@stacksjs/ts-cloud'
export type {
  AWSClientConfig,
  AWSError,
  AWSRequestOptions,
  S3CopyOptions,
  S3ListOptions,
  S3Object,
  S3SyncOptions,
} from '@stacksjs/ts-cloud'
export { buildQueryParams } from '@stacksjs/ts-cloud/aws'
export type {
  AWSCredentials,
  CreateSecretOptions,
  GetSecretValueOptions,
  PutSecretValueOptions,
  RotationRules,
  Secret,
  SecretValue,
  UpdateSecretOptions,
} from '@stacksjs/ts-cloud/aws'
