import { describe, expect, test } from 'bun:test'
import { readdirSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

function stxFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name)
    if (entry.isDirectory())
      return stxFiles(path)
    return path.endsWith('.stx') ? [path] : []
  })
}

describe('dashboard copy contract', () => {
  test('keeps dashboard sources free of separator dash typography', () => {
    const files = [
      ...stxFiles(resolve('storage/framework/defaults/resources/components/Dashboard')),
      ...stxFiles(resolve('storage/framework/defaults/views/dashboard')),
    ]
    const violations = files.filter((file) => {
      const source = readFileSync(file, 'utf8')
      return source.includes('\u2014') || source.includes('\u2013')
    })

    expect(violations).toEqual([])
  })
})
