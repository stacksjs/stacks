/**
 * The available npm scripts within the Stacks toolkit.
 */
export enum NpmScript {
  Build = 'build',
  BuildWebComponents = 'build:web-components',
  BuildFunctions = 'build:functions',
  BuildDocs = 'build:docs',
  BuildStacks = 'build:stacks',
  Clean = 'bunx --bun rimraf bun.lock node_modules/ stacks/**/dist',
  Dev = 'dev',
  DevApi = 'dev:api',
  DevDocs = 'dev:docs',
  DevDesktop = 'dev:desktop',
  DevFunctions = 'dev:functions',
  Fresh = 'fresh',
  Lint = 'bunx --bun pickier .',
  LintFix = 'bunx --bun pickier . --fix',
  LintPackageJson = 'publint',
  MakeStack = 'make:stack',
  Test = 'bun test ./tests/feature/** ./tests/unit/**',
  TestUnit = 'bun test ./tests/unit/**',
  TestFeature = 'bun test ./tests/feature/**',
  TestUi = 'bun test ./tests/Browser/**',
  TestTypes = 'bun x --bun tsc --noEmit -p tsconfig.json --pretty false',
  Generate = 'generate',
  GenerateTypes = 'generate:types',
  GenerateEntries = 'generate:entries',
  GenerateWebTypes = 'generate:web-types',
  GenerateIdeHelpers = 'generate:ide-helpers',
  GenerateComponentMeta = 'generate:component-meta',
  Release = 'release',
  Commit = 'commit',
  Example = 'example',
  ExampleWebComponents = 'example:web-components',
  KeyGenerate = 'key:generate',
  TypesFix = 'types:fix',
  TypesGenerate = 'types:generate',
  Preinstall = 'preinstall',
  Prepublish = 'prepublish',
  UpgradeBun = './storage/framework/scripts/setup.sh +bun.sh',
  UpgradeDependencies = 'pantry --update && bun install',
}

/**
 * Every action the framework can run, and where each one's source is.
 *
 * The value is the path: `Action.BuildViews` is `'build/views'`, which lives at
 * `storage/framework/core/actions/src/build/views.ts`. `runAction` resolves it
 * that way at runtime, and the per-member link below is the same mapping made
 * clickable - "Go to Definition" on `Action.BuildViews` lands here, on the enum
 * member, which is a string rather than the code that runs
 * (stacksjs/stacks#591). The link in the hover is the second hop.
 *
 * `action-source-links.test.ts` keeps them honest: it fails when a member has
 * no link, when a link disagrees with the value, or when the file a value names
 * does not exist - which is also how a renamed action gets caught.
 */
export enum Action {
  /** [`bump`](../../actions/src/bump.ts) */
  Bump = 'bump',
  /** [`build/views`](../../actions/src/build/views.ts) */
  BuildViews = 'build/views',
  /** [`build/stacks`](../../actions/src/build/stacks.ts) */
  BuildStacks = 'build/stacks',
  /** [`build/component-libs`](../../actions/src/build/component-libs.ts) */
  BuildComponentLibs = 'build/component-libs',
  /** [`build-web-component-lib`](../../actions/src/build-web-component-lib.ts) */
  BuildWebComponentLib = 'build-web-component-lib',
  /** [`build-function-lib`](../../actions/src/build-function-lib.ts) */
  BuildFunctionLib = 'build-function-lib',
  /** [`build/libs`](../../actions/src/build/libs.ts) */
  BuildLibs = 'build/libs',
  /** [`build/cli`](../../actions/src/build/cli.ts) */
  BuildCli = 'build/cli',
  /** [`build/core`](../../actions/src/build/core.ts) */
  BuildCore = 'build/core',
  /** [`build/desktop`](../../actions/src/build/desktop.ts) */
  BuildDesktop = 'build/desktop',
  /** [`build/dmg`](../../actions/src/build/dmg.ts) */
  BuildDmg = 'build/dmg',
  /** [`build/docs`](../../actions/src/build/docs.ts) */
  BuildDocs = 'build/docs',
  /** [`build/frontend-static`](../../actions/src/build/frontend-static.ts) */
  BuildFrontendStatic = 'build/frontend-static',
  /** [`build/android`](../../actions/src/build/android.ts) */
  BuildAndroid = 'build/android',
  /** [`build/ios`](../../actions/src/build/ios.ts) */
  BuildIos = 'build/ios',
  /** [`build/server`](../../actions/src/build/server.ts) */
  BuildServer = 'build/server',
  /** [`changelog`](../../actions/src/changelog.ts) */
  Changelog = 'changelog',
  /** [`check/ports`](../../actions/src/check/ports.ts) */
  CheckPorts = 'check/ports',
  /** [`clean`](../../actions/src/clean.ts) */
  Clean = 'clean',
  /** [`auth/token`](../../actions/src/auth/token.ts) */
  CreatePersonalAccessClient = 'auth/token',
  /** [`auth/setup`](../../actions/src/auth/setup.ts) */
  AuthSetup = 'auth/setup',
  /** [`auth/client`](../../actions/src/auth/client.ts) */
  AuthClient = 'auth/client',
  /** [`auth/prune`](../../actions/src/auth/prune.ts) */
  AuthPrune = 'auth/prune',
  /** [`dev/components`](../../actions/src/dev/components.ts) */
  DevComponents = 'dev/components',
  /** [`dev/dashboard`](../../actions/src/dev/dashboard.ts) */
  DevDashboard = 'dev/dashboard',
  /** [`dev/system-tray`](../../actions/src/dev/system-tray.ts) */
  DevSystemTray = 'dev/system-tray',
  /** [`dev/views`](../../actions/src/dev/views.ts) */
  Dev = 'dev/views',
  /** [`dev/api`](../../actions/src/dev/api.ts) */
  DevApi = 'dev/api',
  /** [`dev/desktop`](../../actions/src/dev/desktop.ts) */
  DevDesktop = 'dev/desktop',
  /** [`dev/docs`](../../actions/src/dev/docs.ts) */
  DevDocs = 'dev/docs',
  /** [`deploy/index`](../../actions/src/deploy/index.ts) */
  Deploy = 'deploy/index',
  /** [`domains/add`](../../actions/src/domains/add.ts) */
  DomainsAdd = 'domains/add',
  /** [`domains/purchase`](../../actions/src/domains/purchase.ts) */
  DomainsPurchase = 'domains/purchase',
  /** [`domains/remove`](../../actions/src/domains/remove.ts) */
  DomainsRemove = 'domains/remove',
  /** [`find-projects`](../../actions/src/find-projects.ts) */
  FindProjects = 'find-projects',
  /** [`fresh`](../../actions/src/fresh.ts) */
  Fresh = 'fresh',
  /** [`generate/lib-entries`](../../actions/src/generate/lib-entries.ts) */
  GenerateLibraryEntries = 'generate/lib-entries',
  /** [`library-publish`](../../actions/src/library-publish.ts) */
  LibraryPublish = 'library-publish',
  /** [`key-generate`](../../actions/src/key-generate.ts) */
  KeyGenerate = 'key-generate',
  /** [`migrate/database`](../../actions/src/migrate/database.ts) */
  Migrate = 'migrate/database',
  /** [`migrate/fresh`](../../actions/src/migrate/fresh.ts) */
  MigrateFresh = 'migrate/fresh',
  /** [`database/seed`](../../actions/src/database/seed.ts) */
  Seed = 'database/seed',
  /** [`lint/index`](../../actions/src/lint/index.ts) */
  Lint = 'lint/index',
  /** [`lint/fix`](../../actions/src/lint/fix.ts) */
  LintFix = 'lint/fix',
  /** [`prepublish`](../../actions/src/prepublish.ts) */
  Prepublish = 'prepublish',
  /** [`queue/table`](../../actions/src/queue/table.ts) */
  QueueTable = 'queue/table',
  /** [`queue/work`](../../actions/src/queue/work.ts) */
  QueueWork = 'queue/work',
  /** [`queue/retry`](../../actions/src/queue/retry.ts) */
  QueueRetry = 'queue/retry',
  /** [`queue/failed`](../../actions/src/queue/failed.ts) */
  QueueFailed = 'queue/failed',
  /** [`queue/clear`](../../actions/src/queue/clear.ts) */
  QueueClear = 'queue/clear',
  /** [`queue/status`](../../actions/src/queue/status.ts) */
  QueueStatus = 'queue/status',
  /** [`queue/flush`](../../actions/src/queue/flush.ts) */
  QueueFlush = 'queue/flush',
  /** [`queue/monitor`](../../actions/src/queue/monitor.ts) */
  QueueMonitor = 'queue/monitor',
  /** [`queue/inspect`](../../actions/src/queue/inspect.ts) */
  QueueInspect = 'queue/inspect',
  /** [`queue/list`](../../actions/src/queue/list.ts) */
  QueueList = 'queue/list',
  // stacksjs/stacks#1885 — DLQ + poison + circuit-breaker CLI
  /** [`queue/dlq`](../../actions/src/queue/dlq.ts) */
  QueueDlq = 'queue/dlq',
  /** [`queue/dlq-retry`](../../actions/src/queue/dlq-retry.ts) */
  QueueDlqRetry = 'queue/dlq-retry',
  /** [`queue/dlq-purge`](../../actions/src/queue/dlq-purge.ts) */
  QueueDlqPurge = 'queue/dlq-purge',
  /** [`queue/quarantine`](../../actions/src/queue/quarantine.ts) */
  QueueQuarantine = 'queue/quarantine',
  /** [`queue/unquarantine`](../../actions/src/queue/unquarantine.ts) */
  QueueUnquarantine = 'queue/unquarantine',
  /** [`queue/pause`](../../actions/src/queue/pause.ts) */
  QueuePause = 'queue/pause',
  /** [`queue/resume`](../../actions/src/queue/resume.ts) */
  QueueResume = 'queue/resume',
  /** [`queue/schedule`](../../actions/src/queue/schedule.ts) */
  QueueSchedule = 'queue/schedule',
  /** [`queue/schedule-list`](../../actions/src/queue/schedule-list.ts) */
  QueueScheduleList = 'queue/schedule-list',
  Release = 'release', // ✅
  RouteList = 'route/list', // ✅
  /** [`saas/setup`](../../actions/src/saas/setup.ts) */
  StripeSetup = 'saas/setup',
  /** [`search/import`](../../actions/src/search/import.ts) */
  SearchEngineImport = 'search/import',
  /** [`search/flush`](../../actions/src/search/flush.ts) */
  SearchEngineFlush = 'search/flush',
  /** [`search/settings-list`](../../actions/src/search/settings-list.ts) */
  SearchEngineListSettings = 'search/settings-list',
  /** [`search/settings`](../../actions/src/search/settings.ts) */
  SearchEnginePushSettings = 'search/settings',
  /** [`schedule/run`](../../actions/src/schedule/run.ts) */
  ScheduleRun = 'schedule/run',
  /** [`test/index`](../../actions/src/test/index.ts) */
  Test = 'test/index',
  /** [`test/ui`](../../actions/src/test/ui.ts) */
  TestUi = 'test/ui',
  /** [`test/unit`](../../actions/src/test/unit.ts) */
  TestUnit = 'test/unit',
  /** [`test/feature`](../../actions/src/test/feature.ts) */
  TestFeature = 'test/feature',
  /** [`typecheck`](../../actions/src/typecheck.ts) */
  Typecheck = 'typecheck',
  /** [`upgrade/index`](../../actions/src/upgrade/index.ts) */
  Upgrade = 'upgrade/index',
  UpgradeBinary = 'upgrade/binary', // the `stacks` binary
  /** [`upgrade/bun`](../../actions/src/upgrade/bun.ts) */
  UpgradeBun = 'upgrade/bun',
  /** [`upgrade/dependencies`](../../actions/src/upgrade/dependencies.ts) */
  UpgradeDeps = 'upgrade/dependencies',
  /** [`upgrade/framework`](../../actions/src/upgrade/framework.ts) */
  UpgradeFramework = 'upgrade/framework',
  /** [`upgrade/shell`](../../actions/src/upgrade/shell.ts) */
  UpgradeShell = 'upgrade/shell',
}
