const fs = require('fs')
const path = require('path')

const composables = fs.readdirSync(path.resolve(__dirname, 'src/composables'))

composables.map(composable => composable.replace('.ts'))

module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'scope-enum': [
      2,
      'always',
      ['', 'docs', 'example', 'release', 'dx', ...composables],
    ],
  },
}
