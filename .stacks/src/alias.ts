/**
 * The following configuration references local aliases.
 */

import { componentsPath, frameworkPath, functionsPath, projectPath } from '@stacksjs/utils'

const alias: Record<string, string> = {
  '~/': projectPath(),
  'stacks': frameworkPath('src/index.ts'),
  'stacks/*': frameworkPath('*'),
  'config': frameworkPath('src/config.ts'),
  'config/*': frameworkPath('*'),
  'components/*': componentsPath('*'),
  'functions/*': functionsPath('*'),
}

export default alias
