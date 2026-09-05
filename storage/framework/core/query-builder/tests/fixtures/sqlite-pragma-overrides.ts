import { configureOrm, createQueryBuilder, getDatabase, releaseOrm, resetConnection, setConfig } from '../../src'

setConfig({ dialect: 'sqlite', database: { database: ':memory:' } })

async function observe() {
  const builder = createQueryBuilder()
  const raw = getDatabase()
  return {
    builder: await builder.unsafe('PRAGMA wal_autocheckpoint').execute(),
    model: raw.query('PRAGMA wal_autocheckpoint').get(),
    builderForeignKeys: await builder.unsafe('PRAGMA foreign_keys').execute(),
    modelForeignKeys: raw.query('PRAGMA foreign_keys').get(),
  }
}

try {
  configureOrm({ database: ':memory:' })
  const defaults = await observe()
  setConfig({ sqlite: { pragmas: ['PRAGMA wal_autocheckpoint = 1000'] } })
  const configured = await observe()
  configureOrm({ database: ':memory:' })
  const reconnected = await observe()
  setConfig({ sqlite: { pragmas: ['PRAGMA wal_autocheckpoint = 2000'] } })
  const changed = await observe()
  setConfig({ sqlite: { pragmas: [] } })
  const restored = await observe()
  console.log(JSON.stringify({ defaults, configured, reconnected, changed, restored }))
}
finally {
  releaseOrm()
  resetConnection()
}
