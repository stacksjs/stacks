export * from './action'
export { add as runAdd } from './add'
export { commit as runCommit } from './commit'
export * from './dev'

export * from './generate'
export * from './helpers'
// Code-style actions, exported so commands import + call them directly
// (`import { lintProject, lintFix } from '@stacksjs/actions'`) instead of
// spawning a deep dist path. Exported from ./lint/lint — the pure module — so
// importing the barrel never pulls the process-exiting ./lint/index script.
export { formatProject, lintFix, lintProject } from './lint/lint'
export * from './setup'

// makeFactory,
export {
  createComponent,
  createDatabase,
  createFactory,
  createFunction,
  createLanguage,
  createMiddleware,
  createMigration,
  createModel,
  createMail,
  createNotification,
  createPage,
  isDryRunActive,
  makeAction,
  makeCertificate,
  makeComponent,
  makeDatabase,
  makeFunction,
  makeLanguage,
  makeMail,
  makeNotification,
  makePage,
  makeQueueTable,
  makeStack,
  make as runMake,
  setDryRun,
} from './make'

export { discoverPackages } from './discover-packages'
export { parseFields, scaffoldCrud } from './scaffold-crud'
export type { CrudField } from './scaffold-crud'
export { installStack, uninstallStack, listStacks } from './stacks'
export type { DiscoveredPackagesManifest, PackageStacksMeta } from './discover-packages'
export { makeJob } from './make-job'
export { makeCommand } from './make-command'
export { makePolicy } from './make-policy'
export { makeResource } from './make-resource'
