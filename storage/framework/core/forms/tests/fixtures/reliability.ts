import assert from 'node:assert/strict'

const dialect = process.env.DB_CONNECTION
assert(dialect === 'sqlite' || dialect === 'postgres' || dialect === 'mysql')
assert(dialect === 'sqlite' ? process.env.DB_DATABASE_PATH : process.env.DB_DATABASE?.startsWith('stacks_test_'))
const { config, overridesReady } = await import('@stacksjs/config')
await overridesReady
const { db, ensureDatabaseConfigLoaded, initializeDbConfig, resetDatabaseConnection, sqlHelpers } = await import('@stacksjs/database')
await ensureDatabaseConfigLoaded()
const connection = dialect === 'sqlite' ? { database: process.env.DB_DATABASE_PATH } : { name: process.env.DB_DATABASE, host: process.env.DB_HOST, port: Number(process.env.DB_PORT), username: process.env.DB_USERNAME, password: process.env.DB_PASSWORD, ssl: process.env.DB_SSL === 'true' }
initializeDbConfig({ app: { env: 'test' }, database: { default: dialect, connections: { [dialect]: connection }, queryLogging: { enabled: false } } })
const { createForm, loadFormByHandle } = await import('../../src/create')
const { loadFormByUuid, publicDefinition } = await import('../../src/definition')
const { exportSubmissionsCsv } = await import('../../src/submissions')
const scenario = process.env.FORMS_RELIABILITY_SCENARIO
const field = (name: string) => ({ name, label: name, type: 'text' as const })
try {
  if (scenario === 'worker') {
    for (const siteId of [1, null])
      await createForm(siteId, { name: `Writer ${process.pid}`, handle: 'cross-process', fields: [field(`field_${process.pid}`)] })
    console.log('worker OK')
  }
  else {
    const h = sqlHelpers(dialect)
    const id = `${h.autoIncrement} ${h.primaryKey}`
    await db.unsafe(`CREATE TABLE forms (id ${id}, uuid VARCHAR(255) UNIQUE, site_id INTEGER, name TEXT, handle VARCHAR(255), status TEXT, settings TEXT, UNIQUE(site_id, handle))`).execute()
    await db.unsafe(`CREATE TABLE form_fields (id ${id}, form_id INTEGER, name VARCHAR(255) CHECK(name != 'blocked'), label TEXT, type TEXT, required BOOLEAN, position INTEGER, width TEXT, options TEXT, conditions TEXT, UNIQUE(form_id, name))`).execute()
    if (scenario === 'scope') {
      const tenant = await createForm(1, { name: 'Tenant', handle: 'scope', fields: [field('name')] })
      const global = await createForm(null, { name: 'Global', handle: 'scope', fields: [field('name')] })
      assert(await loadFormByUuid(tenant.uuid, 1))
      assert.equal(await loadFormByUuid(tenant.uuid, 2), null)
      assert.equal(await loadFormByUuid(tenant.uuid, null), null)
      assert.equal(await loadFormByUuid(global.uuid, 1), null)
      assert(await loadFormByUuid(global.uuid, null))
      assert.equal((await loadFormByHandle(null, 'scope'))?.uuid, global.uuid)
    }
    else if (scenario === 'atomic') {
      const original = await createForm(1, { name: 'Original', handle: 'atomic', fields: [field('old')] })
      await assert.rejects(createForm(1, { name: 'Changed', handle: 'atomic', fields: [field('new'), field('blocked')] }))
      const after = await loadFormByUuid(original.uuid, 1)
      assert.equal(after?.name, 'Original')
      assert.deepEqual(after?.fields.map(item => item.name), ['old'])
      await assert.rejects(createForm(1, { name: 'Failed', handle: 'failed', fields: [field('new'), field('blocked')] }))
      assert.equal(await loadFormByHandle(1, 'failed'), null)
    }
    else if (scenario === 'concurrent') {
      for (const siteId of [1, null]) {
        const results = await Promise.all(Array.from({ length: 10 }, (_, index) => createForm(siteId, { name: `Writer ${index}`, handle: 'concurrent', fields: [field(`field_${index}`)] })))
        assert.equal(new Set(results.map(item => item.id)).size, 1)
        assert.equal(results.filter(item => item.created).length, 1)
        const stored = await loadFormByHandle(siteId, 'concurrent')
        assert(stored)
        assert.equal(stored.fields.length, 1, 'one complete field document wins')
        assert.equal(stored.fields[0]?.name, `field_${stored.name.split(' ')[1]}`)
      }
    }
    else if (scenario === 'decoded-json') {
      const created = await createForm(1, { name: 'JSON', handle: 'json', fields: [field('name')] })
      for (const malformed of ['null', '[]', '1', '"text"']) {
        await db.updateTable('forms').set({ settings: malformed }).where('id', '=', created.id).execute()
        await db.updateTable('form_fields').set({ options: malformed, conditions: malformed }).where('form_id', '=', created.id).execute()
        const loaded = await loadFormByUuid(created.uuid, 1)
        assert(loaded)
        const projected = publicDefinition(loaded)
        assert.equal(projected.submitLabel, 'Submit')
        assert.deepEqual(loaded.fields[0]?.options, {})
        assert.equal(loaded.fields[0]?.conditions, null)
      }
      await db.updateTable('forms').set({ settings: '{"notifyEmails":null,"confirmation":null,"payment":null}' }).where('id', '=', created.id).execute()
      await db.updateTable('form_fields').set({ options: '{"choices":null,"accept":null}', conditions: null }).where('form_id', '=', created.id).execute()
      assert(await loadFormByUuid(created.uuid, 1), 'null optional metadata retains absent-value semantics')
      await db.updateTable('forms').set({ settings: '{}' }).where('id', '=', created.id).execute()
      for (const conditions of ['{"rules":null}', '{"rules":[null],"action":"show","logic":"all"}']) {
        await db.updateTable('form_fields').set({ options: '{}', conditions }).where('form_id', '=', created.id).execute()
        assert.equal(await loadFormByUuid(created.uuid, 1), null, 'malformed nested conditions withhold the form')
      }
      await db.updateTable('form_fields').set({ options: '{"choices":{}}', conditions: null }).where('form_id', '=', created.id).execute()
      assert.equal(await loadFormByUuid(created.uuid, 1), null, 'malformed nested choices withhold the form')
    }
    else if (scenario === 'cross-process') {
      const children = Array.from({ length: 6 }, () => Bun.spawn([process.execPath, '--no-env-file', import.meta.filename], {
        env: { ...process.env, FORMS_RELIABILITY_SCENARIO: 'worker' }, stdout: 'pipe', stderr: 'pipe',
      }))
      try {
        await Promise.all(children.map(async (child) => {
          const [code, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()])
          assert.equal(code, 0, `${stdout}\n${stderr}`)
          assert(stdout.includes('worker OK'))
        }))
        assert.equal((await db.selectFrom('forms').where('handle', '=', 'cross-process').selectAll().execute()).length, 2)
        for (const siteId of [1, null]) {
          const stored = await loadFormByHandle(siteId, 'cross-process')
          assert(stored)
          assert.deepEqual(stored.fields.map(item => item.name), [`field_${stored.name.split(' ')[1]}`])
        }
      }
      finally { children.forEach(child => child.kill()) }
    }
    else if (scenario === 'nested') {
      if (dialect === 'mysql') {
        await assert.rejects(async () => db.transaction(() => createForm(null, { name: 'Nested', handle: 'nested', fields: [field('name')] })), /outside an enclosing MySQL transaction/)
        assert.equal(await loadFormByHandle(null, 'nested'), null)
      }
      else {
        const run = async () => {
          await createForm(null, { name: 'Nested', handle: 'nested', fields: [field('name')] })
          throw new Error('rollback nested provisioning')
        }
        await assert.rejects(async () => db.transaction(run, { isolation: 'serializable', ...(dialect === 'sqlite' ? { sqliteMode: 'immediate' as const } : {}) }), /rollback nested provisioning/)
        assert.equal(await loadFormByHandle(null, 'nested'), null)
        if (dialect === 'postgres') {
          const provisioned = await Promise.all(Array.from({ length: 10 }, (_, index) => db.transaction(
            () => createForm(null, { name: `Nested ${index}`, handle: 'nested-concurrent', fields: [field(`field_${index}`)] }), { isolation: 'read committed' },
          )))
          assert.equal(new Set(provisioned.map(item => item.id)).size, 1)
          assert.equal(provisioned.filter(item => item.created).length, 1)
          const stored = await loadFormByHandle(null, 'nested-concurrent')
          assert(stored)
          assert.deepEqual(stored.fields.map(item => item.name), [`field_${stored.name.split(' ')[1]}`])
          let releaseSnapshots!: () => void
          const snapshotsReady = new Promise<void>((resolve) => { releaseSnapshots = resolve })
          const attempts = [0, 0]
          let ready = 0
          const serializable = await Promise.all(attempts.map((count, index) => db.transaction(async () => {
            attempts[index] = (attempts[index] ?? count) + 1
            await db.selectFrom('forms').where('handle', '=', 'serializable-parent').execute()
            if (attempts[index] === 1) {
              if (++ready === 2) releaseSnapshots()
              await snapshotsReady
            }
            return createForm(null, { name: `Serializable ${index}`, handle: 'serializable-parent', fields: [field(`field_${index}`)] })
          }, { isolation: 'serializable', retries: 2 })))
          assert.equal(new Set(serializable.map(item => item.id)).size, 1)
          assert.equal(serializable.filter(item => item.created).length, 1)
          assert(attempts.reduce((sum, count) => sum + count, 0) > 2, 'the owner retries its stale serializable snapshot')
          await assert.rejects(async () => db.transaction(
            () => createForm(null, { name: 'Unsafe', handle: 'unsafe', fields: [field('name')] }), { isolation: 'repeatable read' },
          ), /requires read committed or serializable/)
          assert.equal(await loadFormByHandle(null, 'unsafe'), null)
        }
      }
    }
    else if (scenario === 'routes') {
      const tenant = await createForm(1, { name: 'Tenant', handle: 'route', fields: [field('name')] })
      const global = await createForm(null, { name: 'Global', handle: 'route', fields: [field('name')] })
      await db.unsafe('CREATE TABLE sites (id INTEGER PRIMARY KEY, uuid TEXT, name TEXT, subdomain TEXT, team_id INTEGER, status TEXT, settings TEXT)').execute()
      await db.insertInto('sites').values({ id: 1, uuid: 'site', name: 'Site', subdomain: 'known', status: 'active', settings: '{}' }).execute()
      Object.assign(config, { sites: { enabled: true, baseDomain: 'campus.test', platformHosts: [], trustProxyHost: false, cacheTtlSeconds: 0 } })
      const { route } = await import('@stacksjs/router')
      await import('../../../../defaults/routes/forms')
      const token = 'a'.repeat(64)
      const send = (host: string, uuid: string, suffix = '') => route.bunRouter.handleRequest(new Request(`http://${host}/api/forms/${uuid}${suffix}`, {
        method: suffix ? 'POST' : 'GET', headers: { host, cookie: `X-CSRF-Token=${token}`, 'x-csrf-token': token, 'content-type': 'application/json' },
        ...(suffix ? { body: '{}' } : {}),
      }))
      assert.equal((await send('known.campus.test', tenant.uuid)).status, 200)
      assert.equal((await send('known.campus.test', global.uuid)).status, 404)
      for (const uuid of [tenant.uuid, global.uuid]) {
        for (const suffix of ['', '/uploads', '/submissions'])
          assert.equal((await send('unknown.campus.test', uuid, suffix)).status, 404)
      }
      Object.assign(config, { sites: { enabled: false } })
      assert.equal((await send('localhost', global.uuid)).status, 200)
      assert.equal((await send('localhost', tenant.uuid)).status, 404)
    }
    else if (scenario === 'csv') {
      const created = await createForm(1, { name: 'Export', handle: 'export', fields: [field('name')] })
      const definition = await loadFormByUuid(created.uuid, 1)
      assert(definition)
      await db.unsafe('CREATE TABLE form_submissions (id INTEGER PRIMARY KEY AUTOINCREMENT, uuid TEXT, form_id INTEGER, data TEXT, email TEXT, name TEXT, status TEXT, amount_cents INTEGER, submitted_at TEXT)').execute()
      await db.unsafe(`WITH RECURSIVE seq(n) AS (SELECT 1 UNION ALL SELECT n+1 FROM seq WHERE n<100001)
        INSERT INTO form_submissions(uuid, form_id, data, status)
        SELECT CAST(n AS TEXT), 1, '{"name":"row-' || n || '"}', 'complete' FROM seq`).execute()
      const lines = (await exportSubmissionsCsv(definition)).split('\n')
      assert.equal(lines.length, 100002, 'header plus every submission')
      assert(lines[1]?.startsWith('row-100001,'))
      assert(lines.at(-1)?.startsWith('row-1,'))
    }
    else throw new Error(`Unknown forms scenario: ${scenario}`)
    console.log(`${scenario} OK`)
  }
}
finally { resetDatabaseConnection() }
