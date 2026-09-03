/*
 * Supply the action runner.
 *
 * Running an action by name is this package's job, but the queue (a job that
 * names an action), the scheduler (`Schedule.action`) and the DNS package (the
 * domain shims) all need to ask for it, and this package imports all three.
 * Importing it back closed a cycle every time. They ask through
 * `@stacksjs/action-runner` now, and this is the answer - registered by the
 * act of importing the action layer at all.
 */
import { setActionRunner } from '@stacksjs/action-runner'
import { runAction } from './helpers'

setActionRunner((action, options) => runAction(action as Parameters<typeof runAction>[0], options))

export * from './action'
export { add as runAdd } from './add'
// The write side of the markdown blog (content/blog/*.md), used by the
// dashboard's blog actions. The read/render side lives in ./blog and stays out
// of this barrel because it lazy-loads BunPress.
export {
  type BlogPost,
  BlogAdminError,
  type BlogPostInput,
  deleteBlogPost,
  getBlogPost,
  listBlogPosts,
  saveBlogPost,
  slugify as blogSlugify,
} from './blog-admin'
export { commit as runCommit } from './commit'
export * from './dev'

export * from './generate'
export * from './helpers'
// Library packages built out of resources/functions and resources/components.
// The config-level surface only — `./library/build` and `./library/publish`
// stay out so importing this barrel never pulls the stx compiler.
export * from './library'
// Code-style actions, exported so commands import + call them directly
// (`import { lintProject, lintFix } from '@stacksjs/actions'`) instead of
// spawning a deep dist path. Exported from ./lint/lint — the pure module — so
// importing the barrel never pulls the process-exiting ./lint/index script.
export { formatProject, lintFix, lintProject } from './lint/lint'
// stx conformance checks behind `buddy lint --stx`. Pure - returns a report
// and never exits, so the command owns rendering and the exit code.
export { DEFAULT_STX_LINT_CONFIG, loadStxLintConfig, runStxLint } from './lint/stx-gate'
export type { StxLintConfig, StxLintReport, StxLintResult } from './lint/stx-gate'
// File-level drift between the vendored framework defaults and the installed
// package. Exported from ./upgrade/package-project — the pure module — so
// importing this barrel never pulls ./upgrade/index, which runs an upgrade on
// import. The cheap version-level check lives in @stacksjs/path, because the
// boot path consults it and cannot depend on this package.
export { measureDefaultsDrift, summarizeStructureChanges } from './upgrade/package-project'
export type { ProjectStructureChange } from './upgrade/package-project'
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
