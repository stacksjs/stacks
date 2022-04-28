const fs = require('fs')
const path = require('path')

const composables = fs.readdirSync(path.resolve(__dirname, 'src/composables'))

module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'scope-enum': [
      2,
      'always',
      ['', 'docs', 'example', 'release', 'dx', 'tooling', 'housecleaning', ...composables.map(item => item.replace(/.ts/g, '')).filter(item => item !== 'index')],
    ],
  },
}
