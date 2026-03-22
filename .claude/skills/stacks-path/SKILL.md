---
name: stacks-path
description: Use when working with file paths in Stacks — 100+ framework-aware path builder functions for every directory in the project (actions, app, config, database, models, routes, storage, etc.), plus Node.js path utilities (join, resolve, basename, dirname, etc.). Covers @stacksjs/path.
license: MIT
compatibility: Bun >= 1.3.0, TypeScript
allowed-tools: Read Edit Write Bash Grep Glob
---

# Stacks Path

100+ path builder functions for every framework directory.

## Key Path
- Core package: `storage/framework/core/path/src/`

## Node.js Path Re-exports
`basename`, `delimiter`, `dirname`, `extname`, `isAbsolute`, `join`, `normalize`, `parse`, `relative`, `resolve`, `sep`, `toNamespacedPath`

## Framework Path Builders

All accept an optional relative path suffix and return absolute paths.

### Application Paths
```typescript
appPath('Models')                  // ~/app/Models
userActionsPath()                  // ~/app/Actions
userComponentsPath()               // ~/app/Components
userViewsPath()                    // ~/app/Views
userFunctionsPath()                // ~/app/Functions
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
runtimePath()                      // ~/storage/framework/core/buddy
buildPath()                        // ~/storage/framework/core/build
cachePath()                        // ~/storage/framework/cache
cloudPath()                        // ~/cloud
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
enumsPath()      envPath()          errorHandlingPath()
eventsPath()     fakerPath()        gitPath()
healthPath()     httpPath()         i18nPath()
lintPath()       loggingPath()      notificationsPath()
objectsPath()    ormPath()          pathPath()
paymentsPath()   pluginsPath()      pushPath()
queuePath()      realtimePath()     routerPath()
schedulerPath()  searchEnginePath() securityPath()
serverPath()     shellPath()        slugPath()
smsPath()        socialsPath()      storagePath()
stringsPath()    testingPath()      tinkerPath()
tunnelPath()     typesPath()        uiPath()
utilsPath()      validationPath()   whoisPath()
```

### Resource Paths
```typescript
assetsPath()                       // ~/resources/assets
resourcesPath()                    // ~/resources
publicPath()                       // ~/public
localesPath()                      // ~/locales
routesPath()                       // ~/routes
```

### Build & Output Paths
```typescript
buildEnginePath()
libsEntriesPath()
frameworkPath()                    // ~/storage/framework
corePath()                         // ~/storage/framework/core
defaultsPath()                     // ~/storage/framework/defaults
defaultsAppPath()
defaultsResourcesPath()
```

### Relative Path Variants
Most paths have `relative*` variants:
```typescript
relativeActionsPath()
relativeAppPath()
```

## Path with Suffix

```typescript
appPath('Models/User.ts')           // ~/app/Models/User.ts
databasePath('migrations')          // ~/storage/framework/core/database/migrations
configPath('app.ts')                // ~/config/app.ts
```

## Gotchas
- Always use `@stacksjs/path` instead of Node's `path` for framework paths
- All paths resolve to absolute paths by default
- Most functions accept an optional relative path suffix
- `relative*` variants return paths relative to project root
- `user*Path()` functions point to application-level directories (app/)
- `built*Path()` functions point to compiled output directories
- Path is a dependency of almost every framework package
- Some paths accept `options` with `relative` flag
