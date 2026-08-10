import { describe, expect, test } from 'bun:test'
import { readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

describe('dashboard RBAC error contract', () => {
  const directory = resolve('storage/framework/defaults/app/Actions/Dashboard/Rbac')

  test('classifies missing entities through the typed auth error', () => {
    const helper = readFileSync(resolve(directory, 'rbac-response.ts'), 'utf8')

    expect(helper).toContain("import { RbacEntityNotFoundError } from '@stacksjs/auth'")
    expect(helper).toContain('error instanceof RbacEntityNotFoundError')
    expect(helper).toContain('response.json({ error: error.message }, 400)')
  })

  test('does not expose operational error text from RBAC actions', () => {
    const source = readdirSync(directory)
      .filter(file => file.endsWith('Action.ts'))
      .map(file => readFileSync(resolve(directory, file), 'utf8'))
      .join('\n')

    expect(source).not.toContain("err instanceof Error ? err.message : 'unknown error'")
    expect(source).not.toContain("msg.includes('not found')")
    expect(source.match(/return rbacActionError\(/g)?.length).toBe(11)
  })
})
