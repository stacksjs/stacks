const name = import.meta.env.APP_NAME || 'Stacks'
const key = import.meta.env.APP_KEY
const env = import.meta.env.APP_ENV || 'local'
const url = import.meta.env.APP_URL || 'http://localhost:3333'
const debug = import.meta.env.APP_DEBUG || true

const timezone = 'UTC'
const locale = 'en'
const fallbackLocale = 'en'
const editor = 'vscode'

const cipher = 'aes-256-cbc'

export { name, env, key, cipher, url, debug, timezone, locale, fallbackLocale, editor }
