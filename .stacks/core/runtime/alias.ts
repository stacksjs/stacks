/**
 * The following configuration references local aliases.
 */

import p from '@stacksjs/path'

const alias: Record<string, string> = {
  '~/*': p.projectPath('*'),
  '@stacksjs/actions': p.actionsPath('src/index.ts'),
  '@stacksjs/actions/*': p.actionsPath('src/*'),
  '@stacksjs/alias': p.aliasPath(),
  '@stacksjs/arrays': p.arraysPath('src/index.ts'),
  '@stacksjs/arrays/*': p.arraysPath('src/*'),
  '@stacksjs/auth': p.authPath('src/index.ts'),
  '@stacksjs/auth/*': p.authPath('src/*'),
  '@stacksjs/build': p.buildPath('src/index.ts'),
  '@stacksjs/build/*': p.buildPath('src/*'),
  '@stacksjs/cache': p.cachePath('src/index.ts'),
  '@stacksjs/cache/*': p.cachePath('src/*'),
  '@stacksjs/cli': p.cliPath('src/index.ts'),
  '@stacksjs/cli/*': p.cliPath('src/*'),
  '@stacksjs/collections': p.collectionsPath('src/index.ts'),
  '@stacksjs/collections/*': p.collectionsPath('src/*'),
  '@stacksjs/config': p.configPath(),
  '@stacksjs/config/*': p.projectPath('config/*'),
  '@stacksjs/docs': p.docsPath('src/index.ts'),
  '@stacksjs/docs/*': p.docsPath('src/*'),
  '@stacksjs/error-handling': p.errorHandlingPath('src/index.ts'),
  '@stacksjs/error-handling/*': p.errorHandlingPath('src/*'),
  '@stacksjs/storage': p.fsPath('src/index.ts'),
  '@stacksjs/storage/*': p.fsPath('src/*'),
  '@stacksjs/git': p.gitPath('src/index.ts'),
  '@stacksjs/git/*': p.gitPath('src/*'),
  '@stacksjs/lint': p.lintPath('src/index.ts'),
  '@stacksjs/lint/*': p.lintPath('src/*'),
  '@stacksjs/x-ray': p.x - rayPath('src/index.ts'),
  '@stacksjs/x-ray/*': p.x - rayPath('src/*'),
  '@stacksjs/modules/*': p.modulesPath('src/*'),
  '@stacksjs/objects': p.objectsPath('src/index.ts'),
  '@stacksjs/objects/*': p.objectsPath('src/*'),
  '@stacksjs/path': p.pathPath('src/index.ts'), // 🤦🏼‍♂️
  '@stacksjs/path/*': p.pathPath('src/*'),
  '@stacksjs/router': p.routerPath('src/index.ts'),
  '@stacksjs/router/*': p.routerPath('src/*'),
  '@stacksjs/security': p.securityPath('src/index.ts'),
  '@stacksjs/security/*': p.securityPath('src/*'),
  '@stacksjs/server': p.serverPath('src/index.ts'),
  '@stacksjs/server/*': p.serverPath('src/*'),
  '@stacksjs/serverless': p.serverlessPath('src/index.ts'),
  '@stacksjs/serverless/*': p.serverlessPath('src/*'),
  '@stacksjs/strings': p.stringsPath('src/index.ts'),
  '@stacksjs/strings/*': p.stringsPath('src/*'),
  '@stacksjs/tests/*': p.testsPath('*'),
  '@stacksjs/types': p.typesPath('src/index.ts'),
  '@stacksjs/types/*': p.typesPath('src/*'),
  '@stacksjs/ui': p.uiPath('src/index.ts'),
  '@stacksjs/ui/*': p.uiPath('src/*'),
  '@stacksjs/utils': p.utilsPath('src/index.ts'),
  '@stacksjs/utils/*': p.utilsPath('src/*'),
  'framework/*': p.frameworkPath('*'),
  'stacks': p.frameworkPath('src/index.ts'),
  'stacks/*': p.frameworkPath('src/*'),
  'config/*': p.projectPath('config/*'),
  'components/*': p.componentsPath('*'),
  'functions/*': p.functionsPath('*'),
  'pages/*': p.pagesPath('*'),
}

export { alias }
