export * from './dev'
export * from './generate'
export * from './helpers'

export { examples as runExample } from './examples'
export { commit as runCommit } from './commit'
export { add as runAdd } from './add'
export {
  make as runMake,
  makeComponent,
  makeDatabase,
  // makeFactory,
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
