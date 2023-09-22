/**
 * **Git Options**
 *
 * This configuration defines all of your git options. Because Stacks is fully-typed, you may
 * hover any of the options below and the definitions will be provided. In case you
 * have any questions, feel free to reach out via Discord or GitHub Discussions.
 */
export interface GitOptions {
  /**
   * **Git Hooks**
   *
   * The git hooks to use.
   *
   * @see https://git-scm.com/docs/githooks
   * @example
   * ```ts
   * git: {
   *   hooks: {
   *    'pre-commit': 'lint-staged',
   *   }
   * }
   * ```
   */
  hooks: GitHooks

  /**
   * **Git Commit Scopes**
   *
   * The git commit scopes to use.
   *
   * @see https://stacksjs.org/docs/git/scopes
   * @example
   * git: [
   *   scopes: [
   *     '', 'ci', 'deps', 'dx', 'release', 'readme', 'test', 'actions', 'build', 'cli',
   *     'config', 'examples', 'functions', 'modules', 'views', 'router', 'scripts',
   *     'ui', 'utils', 'arrays', 'collections', 'fs', 'objects', 'strings',
   *   ]
   * ]
   */
  scopes: string[]

  /**
   * **Git Commit Types**
   *
   * The git commit types to use.
   *
   * @default array
   * @see https://stacksjs.org/docs/git/types
   * @see https://www.conventionalcommits.org/en/v1.0.0/
   * @example
   * ```ts
   * git: [
   *   types: [
   *     'build', 'chore', 'ci', 'docs', 'feat', 'fix', 'perf', 'refactor', 'revert', 'style', 'test',
   *    ]
   * ]
   * ```
   */
  types: {
    value: string
    name: string
    emoji: string
  }[]

  /**
   * **Messages—Options**
   *
   * The git messages/prompts to use.
   *
   * @default object
   * @example
   * ```ts
   * messages: {
   *   type: 'Select the type of change that you’re committing:',
   *   scope: 'Denote the SCOPE of this change:',
   *   subject: 'Write a SHORT, IMPERATIVE tense description of the change:\n',
   *   body: 'Provide a LONGER description of the change (optional). Use "|" to break new line:\n',
   *   breaking: 'List any BREAKING CHANGES (optional):\n',
   *   footer: 'List any ISSUES CLOSED by this change (optional). E.g.: #31, #34:\n',
   *   confirmCommit: 'Are you sure you want to proceed with the commit above?',
   * }
   * ```
   * @see https://stacksjs.org/docs/git/messages
   */
  messages: {
    type: string
    scope: string
    customScope: string
    subject: string
    body: string
    breaking: string
    footerPrefixesSelect: string
    customFooterPrefixes: string
    footer: string
    confirmCommit: string
  }
}

interface Hooks {
  'applypatch-msg'?: string
  'pre-applypatch'?: string
  'post-applypatch'?: string
  'pre-commit'?: string
  'pre-merge-commit'?: string
  'prepare-commit-msg'?: string
  'commit-msg'?: string
  'post-commit'?: string
  'pre-rebase'?: string
  'post-checkout'?: string
  'post-merge'?: string
  'pre-push'?: string
  'pre-receive'?: string
  'update'?: string
  'proc-receive'?: string
  'post-receive'?: string
  'post-update'?: string
  'reference-transaction'?: string
  'push-to-checkout'?: string
  'pre-auto-gc'?: string
  'post-rewrite'?: string
  'sendemail-validate'?: string
  'fsmonitor-watchman'?: string
  'p4-changelist'?: string
  'p4-prepare-changelist'?: string
  'p4-post-changelist'?: string
  'p4-pre-submit'?: string
  'post-index-change'?: string
}

export type GitConfig = Partial<GitOptions>

export interface GitHooks extends Hooks {}
