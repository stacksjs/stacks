const { readdirSync } = require('node:fs')
const { resolve } = require('node:path')
const { paramCase } = require('change-case')
// eslint-disable-next-line no-console
console.log('here __filename', __filename)
const jiti = require('jiti')(__filename)
// eslint-disable-next-line no-console
// console.log('jiti', jiti)
const git = jiti('./config/git.ts')
console.log('git is', git)

const toDelete = ['readme-md']

const components = readdirSync(resolve(__dirname, './components'))
  .map(item => paramCase(item.replace(/.vue/g, '')))
  .filter(item => !toDelete.includes(item))

const functions = readdirSync(resolve(__dirname, './functions'))
  .map(item => paramCase(item.replace(/.ts/g, '')))
  .filter(item => !toDelete.includes(item))

const scopes = [...git.default.scopes, ...components, ...functions]
const uniqueScopes = [...new Set(scopes)]

/** @type {import('cz-git').UserConfig} */
module.exports = {
  rules: {
    // @see: https://commitlint.js.org/#/reference-rules
    'scope-enum': [
      2, 'always',
      uniqueScopes,
    ],
  },
  prompt: {
    messages: git.default.messages,
    types: git.default.types,
    useEmoji: false,
    themeColorCode: '',
    scopes: uniqueScopes,
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
