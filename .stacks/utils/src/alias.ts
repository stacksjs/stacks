/**
 * The following configuration references local aliases.
 */

import { actionsPath, arraysPath, buildPath, componentsPath, configPath, frameworkPath, functionsPath, modulesPath, projectPath, routerPath, securityPath, typesPath, uiPath } from './'

const alias: Record<string, string> = {
  '~/': projectPath(),
  'actions': actionsPath('src/index.ts'),
  'actions/*': actionsPath('src/*'),
  'build': buildPath('src/index.ts'),
  'build/*': buildPath('src/*'),
  'cli': cliPath('src/index.ts'),
  'cli/*': cliPath('src/*'),
  'framework': frameworkPath(),
  'framework/*': frameworkPath('*'),
  'stacks': frameworkPath('src/index.ts'),
  'stacks/*': frameworkPath('*'),
  'config': configPath('src/index.ts'),
  'config/*': projectPath('config/*'),
  'components/*': componentsPath('*'),
  'functions/*': functionsPath('*'),
  'modules/*': modulesPath('src/*'),
  'helpers': frameworkPath('src/helpers.ts'),
  'router': routerPath('src/index.ts'),
  'router/*': routerPath('src/*'),
  'security': securityPath('src/index.ts'),
  'security/*': securityPath('src/*'),
  'types': typesPath('src/index.ts'),
  'types/*': typesPath('src/*'),
  'ui': uiPath('src/index.ts'),
  'ui/*': uiPath('src/*'),
  'arrays': arraysPath('src/index.ts'),
  'arrays/*': arraysPath('src/*'),
}

//       "collections": [
//         "./utils/collections/src/index.ts"
//       ],
//       "stacks:fs": [
//         "./utils/fs/src/index.ts"
//       ],
//       "objects": [
//         "./utils/objects/src/index.ts"
//       ],
//       "strings": [
//         "./utils/strings/src/index.ts"
//       ],
//       "utils": [
//         "./utils/src/index.ts"
//       ],
//       "stacks": [
//         "./src/index.ts"
//       ],
//       "stacks/*": [
//         "./src/*"
//       ],
//       "components/*": [
//         "../components/*"
//       ],
//       "config": [
//         "./config/src/index.ts"
//       ],
//       "config/*": [
//         "../config/*"
//       ],
//       "functions/*": [
//         "../functions/*"
//       ],
//       "pages/*": [
//         "../pages/*"
//       ],
//       "~/*": [
//         "../*"
//       ]

export { alias }
