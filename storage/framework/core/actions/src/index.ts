export * from './action'
export * from './dev'
export * from './generate'
export * from './helpers'

export { commit as runCommit } from './commit'
export { add as runAdd } from './add'

// makeFactory,
export {
  make as runMake,
  makeComponent,
  makeDatabase,
  makeFunction,
  makeLanguage,
  makeNotification,
  makePage,
  makeStack,
  createComponent,
  createDatabase,
  createFactory,
  createFunction,
  createLanguage,
  createMigration,
  createModel,
  createNotification,
  createPage,
} from './make'
