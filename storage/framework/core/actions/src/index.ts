export * from './action'
export { add as runAdd } from './add'
export { commit as runCommit } from './commit'
export * from './dev'

export * from './generate'
export * from './helpers'

// makeFactory,
export {
  createComponent,
  createDatabase,
  createFactory,
  createFunction,
  createLanguage,
  createMigration,
  createModel,
  createNotification,
  createPage,
  make as runMake,
  makeAction,
  makeComponent,
  makeDatabase,
  makeFunction,
  makeLanguage,
  makeNotification,
  makePage,
  makeStack,
} from './make'
