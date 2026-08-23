export * from './fetcher'
export * from './generate-client'
export * from './generate-openapi'
export * from './generate-types'
export * from './resource'

/*
 * The zero-generation typed client. Also reachable as
 * `@stacksjs/api/typed-client`, which is the import a browser bundle should
 * use - this barrel pulls in the OpenAPI generator, which has no business in
 * one.
 */
export * from './typed-client'
