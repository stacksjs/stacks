import assert from 'node:assert/strict'

const file = process.argv[2]
assert(file, 'An isolated database path must be supplied')
assert.equal(process.env.DB_DATABASE_PATH, file)
const { overridesReady } = await import('@stacksjs/config')
const { db, ensureDatabaseConfigLoaded, initializeDbConfig, resetDatabaseConnection } = await import('@stacksjs/database/utils')
await overridesReady
await ensureDatabaseConfigLoaded()
initializeDbConfig({
  app: { env: 'production' },
  database: { default: 'sqlite', connections: { sqlite: { database: file } }, queryLogging: { enabled: false } },
})

try {
  await db.unsafe('CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT)').execute()
  await db.unsafe("INSERT INTO users VALUES (1, 'allowed'), (2, 'other')").execute()
  const { createStacksRouter, defineRouteModelBinding } = await import('@stacksjs/router')
  // Load the convention fallback before importing the ORM through its public
  // root, then use the real model implementation against the isolated database.
  await import('../../../../defaults/app/Middleware/Can')
  const orm = await import('@stacksjs/orm')
  await orm.ormReady
  assert.equal((await orm.User.find(1))?.name, 'allowed')
  const { Gate } = await import('@stacksjs/auth')
  Gate.define('convention-view', (user, model: { id: number, name: string } | undefined) => user?.id === model?.id && model?.name === 'allowed')
  Gate.define('convention-raw', (user, value: unknown) => user?.id === 1 && value === 'entry')

  for (const nativeRoutes of [false, true]) {
    const router = createStacksRouter({ autoDiscoverRoutes: false })
    router.use({ handle(req) {
      const user = req.headers.get('x-fixture-user')
      if (user) req._authenticatedUser = { id: Number(user) }
    } })
    const path = `/can-convention-${nativeRoutes}`
    let calls = 0
    router.get(`${path}/users/{user}`, () => ({ calls: ++calls })).middleware('can:convention-view,user')
    router.get(`${path}/raw/{slugToken}`, () => ({ calls: ++calls })).middleware('can:convention-raw,slugToken')
    router.get(`${path}/override/{product}`, () => ({ calls: ++calls })).middleware('can:convention-view,product')
    defineRouteModelBinding('product', () => ({ id: 1, name: 'allowed' }))
    const server = await router.serve({ port: 0, hostname: '127.0.0.1', nativeRoutes })
    try {
      const base = `http://127.0.0.1:${server.port}${path}`
      const request = (suffix: string, user = 1) => fetch(`${base}/${suffix}`, {
        headers: { accept: 'application/json', 'x-fixture-user': String(user) },
      })
      const expectStatus = async (suffix: string, status: number, user = 1) => {
        const response = await request(suffix, user)
        assert.equal(response.status, status, `${suffix}, user=${user}, nativeRoutes=${nativeRoutes}`)
        assert.equal(response.headers.get('x-content-type-options'), 'nosniff')
        const body = await response.json()
        if (status === 403) assert.equal(body.error, 'Forbidden')
        else assert.equal(typeof body.calls, 'number')
      }
      await expectStatus('users/1', 200)
      await Promise.all([
        expectStatus('users/1', 403, 2),
        expectStatus('users/2', 403),
        expectStatus('users/999', 403),
        expectStatus('raw/entry', 200),
        expectStatus('raw/different', 403),
        expectStatus('override/999', 200),
      ])
      await db.unsafe("UPDATE users SET name = 'revoked' WHERE id = 1").execute()
      await expectStatus('users/1', 403)
      await db.unsafe("UPDATE users SET name = 'allowed' WHERE id = 1").execute()
      await expectStatus('users/1', 200)
      Gate.define('convention-view', () => false)
      await expectStatus('users/1', 403)
      Gate.define('convention-view', (user, model: { id: number, name: string } | undefined) => user?.id === model?.id && model?.name === 'allowed')
      assert.equal(calls, 4)
      console.log(`PASS real ORM convention, live rows/policy, raw values and explicit binding, nativeRoutes=${nativeRoutes}`)
    }
    finally {
      await server.stop(true)
    }
  }
}
finally {
  resetDatabaseConnection()
}
