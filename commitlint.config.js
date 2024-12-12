import { components, functions } from '@stacksjs/utils'
import git from './config/git'

const scopes = [...new Set([...git.scopes, ...components, ...functions])]

/** @type {import('cz-git').UserConfig} */
export default {
  rules: {
    // @see: https://commitlint.js.org/#/reference-rules
    'scope-enum': [2, 'always', scopes],
  },

  prompt: {
    messages: git.messages,
    types: git.types,
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
    issuePrefixes: [{ value: 'closed', name: 'closed:   ISSUES has been processed' }],
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
