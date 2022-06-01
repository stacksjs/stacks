import fs from 'fs'
import { resolve } from 'path'
import type { UserConfig } from '@commitlint/types'

const packages = fs.readdirSync(resolve(__dirname, 'packages'))
const composables = fs.readdirSync(resolve(__dirname, 'packages/composables/src'))

const Configuration: UserConfig = {
  /*
   * Resolve and load @commitlint/config-conventional from node_modules.
   * Referenced packages must be installed
   */
  extends: ['@commitlint/config-conventional'],
  /*
   * Resolve and load conventional-changelog-atom from node_modules.
   * Referenced packages must be installed
   */
  // parserPreset: 'conventional-changelog-atom',
  /*
   * Resolve and load @commitlint/format from node_modules.
   * Referenced package must be installed
   */
  // formatter: '@commitlint/format',
  /*
   * Any rules defined here will override rules from @commitlint/config-conventional
   */
  rules: {
    // 'type-enum': [2, 'always', ['foo']],
    'scope-enum': [
      2, 'always',
      [
        '', 'examples', 'playground', 'deps', 'release', 'cleanup', 'refactor', 'readme', 'build',
        ...packages.filter(item => item !== '.eslintrc-auto-import.json' && item !== 'shims.d.ts'),
        ...composables.map(item => item.replace(/.ts/g, '')).filter(item => item !== 'index'),
      ],
    ],
  },

  /*
   * Functions that return true if commitlint should ignore the given message.
   */
  // ignores: [(commit) => commit === ''],
  /*
   * Whether commitlint uses the default ignore rules.
   */
  // defaultIgnores: true,
  /*
   * Custom URL to show upon failure
   */
  // helpUrl: 'https://github.com/conventional-changelog/commitlint/#what-is-commitlint',
  /*
   * Custom prompt configs
   */
  // prompt: {
  //   messages: {},
  //   questions: {
  //     type: {
  //       description: 'please input type:',
  //     },
  //   },
  // },
}

module.exports = Configuration
