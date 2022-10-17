/**
 * The following configuration references local aliases.
 */

import { componentsPath, configPath, frameworkPath, functionsPath, projectPath } from 'stacks'

const alias: Record<string, string> = {
  '~/': projectPath(),
  'stacks': frameworkPath('core/index.ts'),
  'stacks/*': frameworkPath('*'),
  'config': configPath(),
  'config/*': configPath('*'),
  'components/*': componentsPath('*'),
  'functions/*': functionsPath('*'),
}

export { alias }
