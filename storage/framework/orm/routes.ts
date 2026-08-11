// Canonical ORM route entrypoint — the file the router loads to register the
// CRUD endpoints a model's `useApi` trait declares.
//
// Through the PACKAGE, not a relative path into `core/`. This file is vendored
// into every app, and an installed app has no `storage/framework/core/` at all:
// the re-export this used to carry pointed there and resolved to nothing, so
// the router's first candidate threw, its second did not exist, and production
// logged "model useApi endpoints are unavailable" and served none of them. The
// specifier below resolves in both layouts — to the workspace package in this
// repository, and to node_modules in an app.
export { default } from '@stacksjs/orm/routes'
