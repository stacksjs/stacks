export * from './fetcher'
export * from './generate-client'
export * from './generate-openapi'
export * from './generate-types'
export * from './resource'


/*
 * The zero-generation typed client is NOT here. It lives in
 * `@stacksjs/bun-router` (re-exported by `@stacksjs/router`), because nothing
 * in it is specific to Stacks and a client has no business being reachable
 * only through a barrel that pulls in the OpenAPI generator. Import
 * `createTypedClient` from `@stacksjs/router`, or from `@stacksjs/bun-router`
 * directly in a browser bundle.
 */
