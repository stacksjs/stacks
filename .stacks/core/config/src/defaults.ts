import type { StacksOptions } from './types'
import { app, cache, cdn, database, debug, dns, email, events, git, hashing, library, notification, pages, payment, searchEngine, services, storage, ui } from './user'

export { // StacksOptions is an interface of all the ./config options
  app,
  cache,
  cdn,
  database,
  debug,
  dns,
  // docs,
  email,
  events,
  git,
  hashing,
  library,
  notification,
  pages,
  payment,
  searchEngine,
  services,
  storage,
  ui,
}
