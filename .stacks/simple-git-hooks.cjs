const jiti = require('jiti')(__filename)

const config = jiti('../config/git.ts')

module.exports = config.hooks
