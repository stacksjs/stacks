import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

describe('framework release artifact staging', () => {
  test('never stages dependency or scratch manifests outside storage/framework', () => {
    const source = readFileSync(resolve(__dirname, '../src/bump.ts'), 'utf8')

    expect(source).toContain("':(glob)storage/framework/**/package.json'")
    expect(source).not.toContain("':(glob)**/package.json'")
  })
})
