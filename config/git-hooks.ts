/**
 * This is the place where you define your git hooks.
 *
 * All available valid git hooks options are:
 *  'applypatch-msg', 'pre-applypatch', 'post-applypatch', 'pre-commit', 'pre-merge-commit', 'prepare-commit-msg', 'commit-msg',
 *  'post-commit', 'pre-rebase', 'post-checkout', 'post-merge', 'pre-push', 'pre-receive', 'update', 'proc-receive', 'post-receive',
 *  'post-update', 'reference-transaction', 'push-to-checkout', 'pre-auto-gc', 'post-rewrite', 'sendemail-validate',
 *  'fsmonitor-watchman', 'p4-changelist', 'p4-prepare-changelist', 'p4-post-changelist', 'p4-pre-submit', 'post-index-change',
 */

const hooks = {
  'pre-commit': 'npx --no-install lint-staged',
  'commit-msg': 'npx --no -- commitlint --config config/changelog.ts --edit $1',
}

module.exports = hooks
