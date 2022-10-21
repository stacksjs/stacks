/**
 * The following configuration references local aliases.
 */

import { actionsPath, aliasPath, arraysPath, buildPath, cliPath, collectionsPath, componentsPath, configPath, frameworkPath, fsPath, functionsPath, helpersPath, modulesPath, objectsPath, pagesPath, pathsPath, projectPath, routerPath, securityPath, stacksPath, stringsPath, typesPath, uiPath } from '@stacksjs/paths'

const alias: Record<string, string> = {
  '~/*': projectPath('*'),
  '@stacksjs/actions/*': actionsPath('src/*'),
  '@stacksjs/actions/generate': actionsPath('src/generate/index.ts'),
  '@stacksjs/alias': aliasPath(),
  '@stacksjs/arrays': arraysPath('src/index.ts'),
  '@stacksjs/arrays/*': arraysPath('src/*'),
  '@stacksjs/build': buildPath('src/index.ts'),
  '@stacksjs/build/*': buildPath('src/*'),
  '@stacksjs/cli': stacksPath('cli.ts'),
  '@stacksjs/cli/*': cliPath('*'),
  '@stacksjs/collections': collectionsPath('src/index.ts'),
  '@stacksjs/collections/*': collectionsPath('src/*'),
  '@stacksjs/config': configPath(),
  '@stacksjs/fs': fsPath('src/index.ts'),
  '@stacksjs/fs/*': fsPath('src/*'),
  '@stacksjs/helpers': helpersPath('src/index.ts'),
  '@stacksjs/helpers/*': helpersPath('src/*'),
  '@stacksjs/modules/*': modulesPath('src/*'),
  '@stacksjs/objects': objectsPath('src/index.ts'),
  '@stacksjs/objects/*': objectsPath('src/*'),
  '@stacksjs/paths': pathsPath('src/index.ts'),
  '@stacksjs/paths/*': pathsPath('src/*'),
  '@stacksjs/router': routerPath('src/index.ts'),
  '@stacksjs/router/*': routerPath('src/*'),
  '@stacksjs/security': securityPath('src/index.ts'),
  '@stacksjs/security/*': securityPath('src/*'),
  '@stacksjs/strings': stringsPath('src/index.ts'),
  '@stacksjs/strings/*': stringsPath('src/*'),
  '@stacksjs/types': typesPath('src/index.ts'),
  '@stacksjs/types/*': typesPath('src/*'),
  '@stacksjs/ui': uiPath('src/index.ts'),
  '@stacksjs/ui/*': uiPath('src/*'),
  'framework/*': frameworkPath('*'),
  'stacks': frameworkPath('src/index.ts'),
  'stacks/*': frameworkPath('src/*'),
  'config/*': projectPath('config/*'),
  'components/*': componentsPath('*'),
  'functions/*': functionsPath('*'),
  'pages/*': pagesPath('*'),
}

export { alias }
