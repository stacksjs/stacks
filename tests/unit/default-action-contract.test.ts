import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

describe('default action contract', () => {
  test('logger demo uses the validated API action lifecycle', () => {
    const action = readFileSync(
      resolve('storage/framework/defaults/app/Actions/LogAction.ts'),
      'utf8',
    )

    expect(action).toContain("import type { RequestInstance } from '@stacksjs/types'")
    expect(action).toContain("method: 'POST'")
    expect(action).toContain('apiResponse: true')
    expect(action).toContain('async handle(request: RequestInstance)')
    expect(action).toContain('await request.validate()')
    expect(action).toContain("schema.enum(['info', 'warn', 'error'])")
    expect(action).toContain('return response.json({ level, message:')
    expect(action).not.toContain('handle(request?:')
    expect(action).not.toContain('// TODO:')
  })
})
