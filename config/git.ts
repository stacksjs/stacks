/**
 * This is the place where you define your git hooks.
 *
 * All available, valid git hooks are:
 *  'applypatch-msg', 'pre-applypatch', 'post-applypatch', 'pre-commit', 'pre-merge-commit', 'prepare-commit-msg', 'commit-msg',
 *  'post-commit', 'pre-rebase', 'post-checkout', 'post-merge', 'pre-push', 'pre-receive', 'update', 'proc-receive', 'post-receive',
 *  'post-update', 'reference-transaction', 'push-to-checkout', 'pre-auto-gc', 'post-rewrite', 'sendemail-validate',
 *  'fsmonitor-watchman', 'p4-changelist', 'p4-prepare-changelist', 'p4-post-changelist', 'p4-pre-submit', 'post-index-change',
 */

export const hooks = {
  'pre-commit': 'lint-staged',
  'commit-msg': 'npx --no -- commitlint --edit $1',
}

/**
 * This is the place where you define your git commit scopes.
 * A scope is a category of commits that share commonalities.
 */
export const scopes = ['', 'ci', 'core', 'config', 'deps', 'dx', 'example', 'play', 'release', 'readme', 'build']
