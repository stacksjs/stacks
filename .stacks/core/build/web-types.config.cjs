const jiti = require('jiti')(__filename)

const config = jiti('./web-types.ts').default

module.exports = config
