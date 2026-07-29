// Canonical ORM route entrypoint.
//
// Keep the implementation in the @stacksjs/orm core source so application
// servers, the dev dashboard, tests, and package builds cannot drift between
// duplicate route generators.
export { default } from '../core/orm/routes'
