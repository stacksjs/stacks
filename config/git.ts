import type { GitConfig } from '@stacksjs/types'

/**
 * **Git Configuration**
 *
 * This configuration defines all of your git options. Because Stacks is fully-typed, you may
 * hover any of the options below and the definitions will be provided. In case you
 * have any questions, feel free to reach out via Discord or GitHub Discussions.
 */
export default {
  hooks: {
    'pre-commit': 'lint-staged',
  },

  scopes: [
    '',
    'ci',
    'deps',
    'dx',
    'release',
    'docs',
    'test',
    'core',
    'actions',
    'arrays',
    'auth',
    'build',
    'cache',
    'cli',
    'cloud',
    'collections',
    'config',
    'database',
    'datetime',
    'docs',
    'errors',
    'git',
    'lint',
    'x-ray',
    'modules',
    'notifications',
    'objects',
    'path',
    'realtime',
    'router',
    'buddy',
    'security',
    'server',
    'storage',
    'strings',
    'tests',
    'types',
    'ui',
    'utils',
  ],

  messages: {
    type: 'Select the type of change that you’re committing:',
    scope: 'Select the SCOPE of this change (optional):',
    customScope: 'Select the SCOPE of this change:',
    subject: 'Write a SHORT, IMPERATIVE tense description of the change:\n',
    body: 'Provide a LONGER description of the change (optional). Use "|" to break new line:\n',
    breaking: 'List any BREAKING CHANGES (optional). Use "|" to break new line:\n',
    footerPrefixesSelect: 'Select the ISSUES type of the change list by this change (optional):',
    customFooterPrefixes: 'Input ISSUES prefix:',
    footer: 'List any ISSUES by this change. E.g.: #31, #34:\n',
    confirmCommit: 'Are you sure you want to proceed with the commit above?',
  },

  types: [
    { value: 'feat', name: 'feat:     ✨  A new feature', emoji: ':sparkles:' },
    { value: 'fix', name: 'fix:      🐛  A bug fix', emoji: ':bug:' },
    {
      value: 'docs',
      name: 'docs:     📝  Documentation only changes',
      emoji: ':memo:',
    },
    {
      value: 'style',
      name: 'style:    💄  Changes that do not affect the meaning of the code',
      emoji: ':lipstick:',
    },
    {
      value: 'refactor',
      name: 'refactor: ♻️   A code change that neither fixes a bug nor adds a feature',
      emoji: ':recycle:',
    },
    {
      value: 'perf',
      name: 'perf:     ⚡️  A code change that improves performance',
      emoji: ':zap:',
    },
    {
      value: 'test',
      name: 'test:     ✅  Adding missing tests or adjusting existing tests',
      emoji: ':white_check_mark:',
    },
    {
      value: 'build',
      name: 'build:    📦️  Changes that affect the build system or external dependencies',
      emoji: ':package:',
    },
    {
      value: 'ci',
      name: 'ci:       🎡  Changes to our CI configuration files and scripts',
      emoji: ':ferris_wheel:',
    },
    {
      value: 'chore',
      name: 'chore:    🔨  Other changes that don’t modify src or test files',
      emoji: ':hammer:',
    },
    {
      value: 'revert',
      name: 'revert:   ⏪️  Reverts a previous commit',
      emoji: ':rewind:',
    },
  ],
} satisfies GitConfig
