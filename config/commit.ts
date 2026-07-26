import type { UserConfig } from 'cz-git'
import git from './git'

// `components` and `functions` used to be appended here from `@stacksjs/utils`,
// which has never exported them: the import resolved to `undefined` and the
// spread silently contributed nothing. It only ever surfaced as a type error
// once @stacksjs/utils started shipping declarations.
const scopes = [...new Set(git.scopes)]

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
    customIssuePrefixsAlign: 'top',
    emptyIssuePrefixsAlias: 'skip',
    customIssuePrefixsAlias: 'custom',
    allowCustomIssuePrefixs: true,
    allowEmptyIssuePrefixs: true,
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
} satisfies UserConfig
