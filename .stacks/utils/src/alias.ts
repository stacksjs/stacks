/**
 * The following configuration references local aliases.
 */

import { actionsPath, arraysPath, buildPath, collectionsPath, componentsPath, configPath, frameworkPath, fsPath, functionsPath, modulesPath, objectsPath, pagesPath, projectPath, routerPath, securityPath, stringsPath, typesPath, uiPath, utilsPath } from './'

const alias: Record<string, string> = {
  '~/*': projectPath('*'),
  'actions': actionsPath('src/index.ts'),
  'actions/*': actionsPath('src/*'),
  'build': buildPath('src/index.ts'),
  'build/*': buildPath('src/*'),
  'cli': cliPath('src/index.ts'),
  'cli/*': cliPath('src/*'),
  'framework': frameworkPath(),
  'framework/*': frameworkPath('*'),
  'stacks': frameworkPath('src/index.ts'),
  'stacks/*': frameworkPath('src/*'),
  'config': configPath('src/index.ts'),
  'config/*': projectPath('config/*'),
  'components/*': componentsPath('*'),
  'functions/*': functionsPath('*'),
  'pages/*': pagesPath('*'),
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
  'collections': collectionsPath('src/index.ts'),
  'collections/*': collectionsPath('src/*'),
  'stacks:fs': fsPath('src/index.ts'),
  'objects': objectsPath('src/index.ts'),
  'objects/*': objectsPath('src/*'),
  'strings': stringsPath('src/index.ts'),
  'strings/*': stringsPath('src/*'),
  'utils': utilsPath('src/index.ts'),
  'utils/*': utilsPath('src/*'),
}

export { alias }
