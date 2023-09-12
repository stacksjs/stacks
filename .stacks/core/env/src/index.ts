interface EnumObject {
  [key: string]: string[];
}

export const enums: EnumObject = {
  APP_ENV: ['development', 'staging', 'production'],
  DB_CONNECTION: ['mysql', 'sqlite', 'postgres', 'planetscale'],
  MAIL_MAILER: ['smtp', 'mailgun', 'ses', 'postmark', 'sendmail', 'log'],
  SEARCH_ENGINE_DRIVER: ['meilisearch', 'algolia', 'typesense'],
  FRONTEND_APP_ENV: ['development', 'staging', 'production'],
}

const handler = {
  get: (target: typeof Bun.env, key: string) => {
    // @ts-ignore
    const value = target[key]
    if (enums[key]?.includes(value)) return value
    if (value === 'true') return true
    if (value === 'false') return false
    if (!isNaN(Number(value))) return Number(value)
    return value
  }
}

export const env = new Proxy(Bun.env, handler)
