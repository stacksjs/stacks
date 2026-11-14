// This is a real fixture application boundary, independent of the caller's cwd.
export default {
  default: process.env.DB_CONNECTION || 'sqlite',
  queryLogging: { enabled: false },
  models: { includeFrameworkDefaults: false },
  connections: {
    sqlite: { database: process.env.DB_DATABASE_PATH || ':memory:' },
    postgres: { name: process.env.DB_DATABASE, host: process.env.DB_HOST, port: Number(process.env.DB_PORT || 5432), username: process.env.DB_USERNAME, password: process.env.DB_PASSWORD },
  },
}
