import type { GitOptions } from 'stacks'

export const git: GitOptions = {
  hooks: {
    'pre-commit': 'lint-staged',
  },

  scopes: [
    '', 'ci', 'core', 'config', 'deps', 'cli', 'docs', 'dx',
    'example', 'release', 'readme', 'build', 'scripts', 'test',
  ],
}
