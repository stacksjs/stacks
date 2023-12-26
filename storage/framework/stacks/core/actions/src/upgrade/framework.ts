// import { outro } from '@stacksjs/cli'
// import { log } from '@stacksjs/logging'
// import * as storage from '@stacksjs/storage'
// import { determineDebugLevel, loop } from '@stacksjs/utils'
// import { frameworkPath, projectPath } from '@stacksjs/path'
//
// // await runCommand(NpmScript.UpgradeFramework, parseArgs())
//
// await checkForUncommittedChanges('./stacks', options)
// await downloadFrameworkUpdate(options)
//
// log.info('Updating framework...')
//
// const exclude = ['functions/package.json', 'components/vue/package.json', 'components/web/package.json', 'auto-imports.d.ts', 'components.d.ts', 'dist']
// await storage.deleteFiles(frameworkPath(), exclude)
//
// // loop 5 times to make sure all "deep empty" folders are deleted
// loop(5, async () => {
//   await storage.deleteEmptyFolders(frameworkPath())
// })
//
// await storage.copyFolder(frameworkPath(), projectPath('./updates/stacks'), exclude)
//
// if (determineDebugLevel(options))
//   log.info('Cleanup...')
//
// await storage.deleteFolder(projectPath('updates'))
//
// outro('Framework updated', { startTime: perf, useSeconds: true })
// process.exit()
