// TODO: refactor to .ts
module.exports = {
  'pre-commit': 'npx --no-install lint-staged',
  'commit-msg': 'npx --no -- commitlint --edit $1',
}
