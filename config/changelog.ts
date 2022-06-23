/**
 * This configuration is used to define your "commit flow."
 *
 * Adjust the values below however you desire. Though, keep in mind:
 * provided default config creates a well-optimized semver commit-flow that consequently helps generate changelogs.
 */

// eslint-disable-next-line @typescript-eslint/no-var-requires
const fs = require('fs')
// eslint-disable-next-line @typescript-eslint/no-var-requires
const path = require('path')

const components = fs.readdirSync(path.resolve(__dirname, '../components'))
  .filter((item: string) => item !== '.eslintrc-auto-import.json' && item !== 'shims.d.ts')

const functions = fs.readdirSync(path.resolve(__dirname, '../functions'))
  .map((item: string) => item.replace(/.ts/g, ''))
  .filter((item: string) => item !== 'index')

const scopes = ['', 'ci', 'core', 'config', 'deps', 'dx', 'example', 'play', 'release', 'readme', 'build', ...components, ...functions]

/** @type {import('cz-git').UserConfig} */
module.exports = {
  rules: {
    // @see: https://commitlint.js.org/#/reference-rules
    'scope-enum': [
      2, 'always',
      scopes,
    ],
  },
  prompt: {
    messages: {
      type: 'Select the type of change that you\'re committing:',
      scope: 'Select the SCOPE of this change (optional):',
      customScope: 'Select the SCOPE of this change:',
      subject: 'Write a SHORT, IMPERATIVE tense description of the change:\n',
      body: 'Provide a LONGER description of the change (optional). Use "|" to break new line:\n',
      breaking: 'List any BREAKING CHANGES (optional). Use "|" to break new line:\n',
      footerPrefixsSelect: 'Select the ISSUES type of changeList by this change (optional):',
      customFooterPrefixs: 'Input ISSUES prefix:',
      footer: 'List any ISSUES by this change. E.g.: #31, #34:\n',
      confirmCommit: 'Are you sure you want to proceed with the commit above?',
    },
    types: [
      { value: 'feat', name: 'feat:     ✨  A new feature', emoji: ':sparkles:' },
      { value: 'fix', name: 'fix:      🐛  A bug fix', emoji: ':bug:' },
      { value: 'docs', name: 'docs:     📝  Documentation only changes', emoji: ':memo:' },
      { value: 'style', name: 'style:    💄  Changes that do not affect the meaning of the code', emoji: ':lipstick:' },
      { value: 'refactor', name: 'refactor: ♻️   A code change that neither fixes a bug nor adds a feature', emoji: ':recycle:' },
      { value: 'perf', name: 'perf:     ⚡️  A code change that improves performance', emoji: ':zap:' },
      { value: 'test', name: 'test:     ✅  Adding missing tests or adjusting existing tests', emoji: ':white_check_mark:' },
      { value: 'build', name: 'build:    📦️  Changes that affect the build system or external dependencies', emoji: ':package:' },
      { value: 'ci', name: 'ci:       🎡  Changes to our CI configuration files and scripts', emoji: ':ferris_wheel:' },
      { value: 'chore', name: 'chore:    🔨  Other changes that don\'t modify src or test files', emoji: ':hammer:' },
      { value: 'revert', name: 'revert:   ⏪️  Reverts a previous commit', emoji: ':rewind:' },
    ],
    useEmoji: false,
    themeColorCode: '',
    scopes,
    allowCustomScopes: true,
    allowEmptyScopes: true,
    customScopesAlign: 'bottom',
    customScopesAlias: 'custom',
    emptyScopesAlias: 'empty',
    upperCaseSubject: false,
    allowBreakingChanges: ['feat', 'fix'],
    breaklineNumber: 100,
    breaklineChar: '|',
    skipQuestions: [],
    issuePrefixs: [{ value: 'closed', name: 'closed:   ISSUES has been processed' }],
    customIssuePrefixsAlign: 'top',
    emptyIssuePrefixsAlias: 'skip',
    customIssuePrefixsAlias: 'custom',
    allowCustomIssuePrefixs: true,
    allowEmptyIssuePrefixs: true,
    confirmColorize: true,
    maxHeaderLength: Infinity,
    maxSubjectLength: Infinity,
    minSubjectLength: 0,
    scopeOverrides: undefined,
    defaultBody: '',
    defaultIssues: '',
    defaultScope: '',
    defaultSubject: '',
  },
}
