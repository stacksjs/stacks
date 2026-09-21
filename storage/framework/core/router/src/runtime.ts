/**
 * Server runtime entrypoint.
 *
 * The package root retains the complete public router surface. API servers can
 * import this entry when they only need route registration and serving, without
 * eagerly loading root-only sessions, signed URLs, model binding, and typed
 * client helpers.
 */
export { response } from '@stacksjs/bun-router'
export * from './stacks-router'
