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
// stx conformance gate (chapter 12 of the stx standards, plus three
// build-output checks). Pure — returns a report and never exits, so
// `buddy lint:stx` owns the rendering and the exit code.
export {
  DEFAULT_STX_GATE_CONFIG,
  loadStxGateConfig,
  runStxGate,
  STX_GATE_CONFIG_FILE,
  writeStxGateBaselines,
} from './lint/stx-gate'
export type { StxGateConfig, StxGateReport, StxGateResult } from './lint/stx-gate-types'
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
