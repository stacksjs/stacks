export * from './cloud'
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
export * from './imap/s3'
export * from './imap/secrets-manager'
export * from './imap/smtp-server'
