const name = 'Stack'
const key = process.env.APP_KEY
const env = process.env.NODE_ENV || 'development'
const url = process.env.APP_URL || 'http://localhost:3333'

const timezone = 'UTC'
const locale = 'en'
const fallbackLocale = 'en'

const cipher = 'aes-256-cbc'

export default { name, env, key, cipher, url, timezone, locale, fallbackLocale }
