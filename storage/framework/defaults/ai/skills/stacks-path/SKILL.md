---
name: stacks-path
description: Use when working with file paths in Stacks - 100+ framework-aware path builder functions for every directory in the project (actions, app, config, database, models, routes, storage, etc.), plus Node.js path utilities (join, resolve, basename, dirname, etc.). Covers @stacksjs/path.
license: MIT
compatibility: Bun >= 1.3.0, TypeScript
allowed-tools: Read Edit Write Bash Grep Glob
---

# Stacks Path

100+ path builder functions for every framework directory.

## Key Path
- Core package: `storage/framework/core/path/src/`

## Node.js Path Re-exports
`basename`, `delimiter`, `dirname`, `extname`, `isAbsolute`, `join`, `normalize`,
`relative`, `resolve`, `sep`, `toNamespacedPath`. `parse` is available through
the `path` facade, not a named root export. Named `sep`/`delimiter` are strings;
their facade counterparts are functions.

## Framework Path Builders

All accept an optional relative path suffix and return absolute paths.

### Application Paths
```typescript
appPath('Models')                  // ~/app/Models
userActionsPath()                  // ~/app/Actions
userComponentsPath()               // ~/resources/components (root components/ wins if present)
userViewsPath()                    // ~/resources/views
userFunctionsPath()                // ~/resources/functions (root functions/ wins if present)
userJobsPath()                     // ~/app/Jobs
userControllersPath()              // ~/app/Controllers
userListenersPath()                // ~/app/Listeners
userMiddlewarePath()               // ~/app/Middleware
userModelsPath()                   // ~/app/Models
userNotificationsPath()            // ~/app/Notifications
userDatabasePath()                 // ~/database
userMigrationsPath()               // ~/database/migrations
userEventsPath()                   // ~/app/Events.ts
```

### Framework Paths
```typescript
actionsPath()                      // ~/storage/framework/core/actions
buddyPath()                        // ~/storage/framework/core/buddy
runtimePath()                      // ~/storage/framework/buddy (Buddy output)
buildPath()                        // ~/storage/framework/core/build
cachePath()                        // ~/storage/framework/core/cache (package source, not cache data)
cloudPath()                        // ~/storage/framework/core/cloud (package source)
projectPath('cloud')               // ~/cloud (application infrastructure)
frameworkCloudPath()               // ~/storage/framework/cloud
libsPath()                         // ~/storage/framework/libs
```

### Package Paths (one per core package)
```typescript
aiPath()         analyticsPath()    aliasPath()
arraysPath()     authPath()         browserPath()
cliPath()        chatPath()         collectionsPath()
configPath()     databasePath()     datetimePath()
dnsPath()        docsPath()         emailPath()
enumsPath()      coreEnvPath()      errorHandlingPath()
eventsPath()     fakerPath()        gitPath()
healthPath()     paginationPath()   featuresPath()
lintPath()       loggingPath()      notificationsPath()
objectsPath()    ormPath()          pathPath()
paymentsPath()   modelMetaPath()    pushPath()
queuePath()      realtimePath()     routerPath()
schedulerPath()  searchEnginePath() securityPath()
serverPath()     shellPath()        slugPath()
smsPath()        socialsPath()      storagePath()
stringsPath()    testingPath()      tinkerPath()
skillsPath()     typesPath()        uiPath()
utilsPath()      validationPath()   actionRunnerPath()
```

### Resource Paths
```typescript
assetsPath()                       // ~/resources/assets
resourcesPath()                    // ~/resources
publicPath()                       // ~/public
langPath()                         // ~/locales
routesPath()                       // ~/routes
```

### Build & Output Paths
```typescript
buildEnginePath()
libsEntriesPath()
frameworkPath()                    // ~/storage/framework
corePath()                         // ~/storage/framework/core
frameworkPath('defaults')          // ~/storage/framework/defaults
defaultsAppPath()
defaultsResourcesPath()
```

### Relative Path Variants
Only some helpers have relative modes. Inspect the selected signature rather
than deriving a function name from another path helper:
```typescript
relativeActionsPath()
layoutsPath('main.stx', { relative: true })
```

## Path with Suffix

```typescript
appPath('Models/User.ts')           // ~/app/Models/User.ts
databasePath('migrations')          // ~/storage/framework/core/database/migrations
projectConfigPath('app.ts')         // ~/config/app.ts
configPath('src/index.ts')          // ~/storage/framework/core/config/src/index.ts
```

## Gotchas
- Distinguish application paths from package paths. `databasePath` and
  `configPath` point to core package sources; `userDatabasePath`,
  `userMigrationsPath` and `projectConfigPath` point to application files.
- Runtime state has explicit helpers: `stxPath`, `frameworkRuntimePath` and
  `cloudStatePath`. `cloudPath` points to the core package; use
  `projectPath('cloud')` for the application's committed infrastructure.
- `defaultsPackagePath` resolves bundled defaults in a packaged install;
  `inspectDefaultsProvenance` reports version/source skew. Use these instead
  of assuming every consumer vendors the entire framework source tree.
- `runtimeDirectoryEnv`/`applyRuntimeDirectoryEnv` carry STX/cloud state roots
  into subprocesses while preserving explicit environment overrides.
- Path joining is not an authorization or root-containment check. Validate
  an untrusted file path at the storage/request boundary before reading it.
- Always use `@stacksjs/path` instead of Node's `path` for framework paths
- All paths resolve to absolute paths by default
- Most functions accept an optional relative path suffix
- `relative*` variants return paths relative to project root
- `user*Path()` functions point to application files; frontend resources are
  under resources, not an invented app/Components or app/Views directory.
- `built*Path()` functions point to compiled output directories
- Path is a dependency of almost every framework package
- Some paths accept `options` with `relative` flag
