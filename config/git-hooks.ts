module.exports = {
  'pre-commit': 'npx --no-install lint-staged',
  'commit-msg': 'npx --no -- commitlint --config config/changelog.ts --edit $1',
}
