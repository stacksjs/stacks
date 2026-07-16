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
