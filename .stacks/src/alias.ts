/**
 * The following configuration references local aliases.
 */

import { componentsPath, frameworkPath, functionsPath, projectPath } from './utils'

const alias: Record<string, string> = {
  '~/': projectPath(),
  'stacks': frameworkPath('src/index.ts'),
  'stacks/*': frameworkPath('*'),
  'functions/*': functionsPath('*'),
  'components/*': componentsPath('*'),
  'config': frameworkPath('src/config.ts'),
}

export default alias
