import { resolve } from '@stacksjs/path'
import { fs } from '@stacksjs/storage'
import { kebabCase } from '@stacksjs/strings'
import git from './config/git'

const ignore = ['readme-md']

const components = fs
  .readdirSync(resolve(__dirname, './resources/components'))
  .map((item) => kebabCase(item.replace(/.stx/g, '')))
  .filter((item) => !ignore.includes(item))

const functions = fs
  .readdirSync(resolve(__dirname, './resources/functions'))
  .map((item) => kebabCase(item.replace(/.ts/g, '')))
  .filter((item) => !ignore.includes(item))

const scopes = [...git.scopes, ...components, ...functions]
const uniqueScopes = [...new Set(scopes)]

/** @type {import('cz-git').UserConfig} */
export default {
  rules: {
    // @see: https://commitlint.js.org/#/reference-rules
    'scope-enum': [2, 'always', uniqueScopes],
  },
  prompt: {
    messages: git.messages,
    types: git.types,
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
    issuePrefixes: [
      { value: 'closed', name: 'closed:   ISSUES has been processed' },
    ],
    customIssuePrefixesAlign: 'top',
    emptyIssuePrefixesAlias: 'skip',
    customIssuePrefixesAlias: 'custom',
    allowCustomIssuePrefixes: true,
    allowEmptyIssuePrefixes: true,
    confirmColorize: true,
    maxHeaderLength: Number.POSITIVE_INFINITY,
    maxSubjectLength: Number.POSITIVE_INFINITY,
    minSubjectLength: 0,
    scopeOverrides: undefined,
    defaultBody: '',
    defaultIssues: '',
    defaultScope: '',
    defaultSubject: '',
  },
}
