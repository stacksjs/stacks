const jiti = require('jiti')(__filename)
const config = jiti('../config/git.ts')

// eslint-disable-next-line no-console
console.log('config', config.hooks)

module.exports = config.hooks
