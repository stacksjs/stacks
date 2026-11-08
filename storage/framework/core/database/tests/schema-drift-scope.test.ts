import { expect, test } from 'bun:test'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { loadSchemaAuditModels } from '../src/schema-drift'

test('schema audits import only models selected for this database, including nested definitions', async () => {
  const root = mkdtempSync(join(tmpdir(), 'stacks-schema-audit-scope-'))
  const marker = Symbol.for(root)
  try {
    mkdirSync(join(root, 'Mail'))
    writeFileSync(join(root, 'User.ts'), "export default { name: 'User', table: 'users' }\n")
    writeFileSync(join(root, 'Mail/Subscriber.ts'), "export default { name: 'Subscriber', table: 'subscribers' }\n")
    writeFileSync(join(root, 'LocalHistory.ts'), `Reflect.set(globalThis, Symbol.for(${JSON.stringify(root)}), true)\nexport default { name: 'LocalHistory', table: 'local_history' }\n`)
    expect((await loadSchemaAuditModels(root, [' user ', 'SUBSCRIBER'])).map(model => model.table).sort()).toEqual(['subscribers', 'users'])
    expect(Reflect.get(globalThis, marker)).toBeUndefined()
    expect(await loadSchemaAuditModels(root, [])).toEqual([])
    expect((await loadSchemaAuditModels(root)).map(model => model.table).sort()).toEqual(['local_history', 'subscribers', 'users'])
    expect(Reflect.get(globalThis, marker)).toBe(true)
  }
  finally {
    Reflect.deleteProperty(globalThis, marker)
    rmSync(root, { recursive: true })
  }
})
