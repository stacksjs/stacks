/**
 * The following configuration references local aliases.
 */

import { actionsPath, componentsPath, configPath, frameworkPath, functionsPath, projectPath } from 'stacks'

const alias: Record<string, string> = {
  '~/': projectPath(),
  'actions': actionsPath(),
  'actions/*': actionsPath(),
  'framework': frameworkPath(),
  'framework/*': frameworkPath(),
  'stacks': frameworkPath('src/index.ts'),
  'stacks/*': frameworkPath('*'),
  'config': configPath(),
  'config/*': configPath('*'),
  'components/*': componentsPath('*'),
  'functions/*': functionsPath('*'),
}

//  "framework/*": [
//         "./*"
//       ],
//       "actions/*": [
//         "./actions/src/*"
//       ],
//       "build": [
//         "./build/src/index.ts"
//       ],
//       "build/*": [
//         "./build/src/*"
//       ],
//       "cli": [
//         "./cli/src/index.ts"
//       ],
//       "cli/*": [
//         "./cli/src/*"
//       ],
//       "helpers": [
//         "./src/helpers.ts"
//       ],
//       "modules/*": [
//         "./modules/src/*"
//       ],
//       "router": [
//         "./router/src/index.ts"
//       ],
//       "router/*": [
//         "./router/src/*"
//       ],
//       "security": [
//         "./security/src/index.ts"
//       ],
//       "types": [
//         "./types/src/index.ts"
//       ],
//       "ui": [
//         "./ui/src/index.ts"
//       ],
//       "arrays": [
//         "./utils/arrays/src/index.ts"
//       ],
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
