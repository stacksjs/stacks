import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

describe('buddy clean safety contract', () => {
  test('returns from a dry run before confirmation or destructive actions', () => {
    const source = readFileSync(
      resolve('storage/framework/core/buddy/src/commands/clean.ts'),
      'utf8',
    )
    const dryRun = source.indexOf('if (options.dryRun)')
    const confirmation = source.indexOf('if (!skipConfirm')
    const action = source.indexOf('runAction(Action.Clean, options)')

    expect(dryRun).toBeGreaterThan(-1)
    expect(dryRun).toBeLessThan(confirmation)
    expect(dryRun).toBeLessThan(action)
    expect(source.slice(dryRun, confirmation)).toContain('return')
    expect(source.slice(dryRun, confirmation)).toContain('No files were removed')
  })
})
