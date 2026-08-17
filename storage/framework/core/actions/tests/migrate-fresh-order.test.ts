import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

describe('migrate:fresh bootstrap order', () => {
  it('creates historical notification dependencies before model migrations', () => {
    const source = readFileSync(join(import.meta.dir, '..', 'src', 'migrate', 'fresh.ts'), 'utf8')
    const bootstrap = source.indexOf("migrateNotificationTables({ tables: ['notifications', 'notification_deliveries'] })")
    const migrate = source.indexOf('const migrateResult = await runDatabaseMigration()')
    const finalGuarantee = source.lastIndexOf('const notifResult = await migrateNotificationTables()')

    expect(bootstrap).toBeGreaterThan(-1)
    expect(bootstrap).toBeLessThan(migrate)
    expect(finalGuarantee).toBeGreaterThan(migrate)
  })

  it('invalidates the Stacks client whenever migrations reset the query-builder connection', () => {
    const source = readFileSync(join(import.meta.dir, '..', '..', 'database', 'src', 'migrations.ts'), 'utf8')

    expect(source).toContain('resetDatabaseConnection()')
    expect(source).not.toMatch(/\bresetConnection\(\)/)
  })
})
