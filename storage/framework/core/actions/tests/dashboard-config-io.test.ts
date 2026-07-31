import { afterEach, describe, expect, it } from 'bun:test'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { listConfigFiles, rewriteConfigKeys } from '../../../defaults/resources/functions/dashboard/config-io'

const source = `export default {
  name: 'Stacks',
  port: 3000,
  enabled: true,
  host: env.APP_HOST ?? 'localhost',
}
`

describe('dashboard config writes', () => {
  let tempDir = ''

  afterEach(() => {
    if (tempDir)
      rmSync(tempDir, { force: true, recursive: true })
    tempDir = ''
  })

  it('rewrites every scalar only after the full batch validates', () => {
    const rewritten = rewriteConfigKeys(source, [
      { key: 'name', value: 'Dashboard' },
      { key: 'port', value: 3002 },
      { key: 'enabled', value: false },
    ])

    expect(rewritten).toContain("name: 'Dashboard'")
    expect(rewritten).toContain('port: 3002')
    expect(rewritten).toContain('enabled: false')
  })

  it('does not expose a partial rewrite when a later field is invalid', () => {
    expect(() => rewriteConfigKeys(source, [
      { key: 'name', value: 'Changed' },
      { key: 'host', value: 'example.test' },
    ])).toThrow('Cannot edit "host"')
    expect(source).toContain("name: 'Stacks'")
  })

  it('rejects duplicate keys instead of applying ambiguous updates', () => {
    expect(() => rewriteConfigKeys(source, [
      { key: 'port', value: 3001 },
      { key: 'port', value: 3002 },
    ])).toThrow('Duplicate or empty configuration key "port"')
  })

  it('lists only real TypeScript config files with their actual size', () => {
    tempDir = mkdtempSync(join(tmpdir(), 'stacks-config-list-'))
    mkdirSync(join(tempDir, 'nested.ts'))
    writeFileSync(join(tempDir, 'app.ts'), source)
    writeFileSync(join(tempDir, 'ai.ts'), source)
    writeFileSync(join(tempDir, '.hidden.ts'), source)
    writeFileSync(join(tempDir, 'notes.txt'), 'notes')

    expect(listConfigFiles(tempDir)).toEqual([
      {
        name: 'ai',
        title: 'AI',
        size: Buffer.byteLength(source),
      },
      {
        name: 'app',
        title: 'App',
        size: Buffer.byteLength(source),
      },
    ])
  })

  it('reports a missing config directory', () => {
    tempDir = mkdtempSync(join(tmpdir(), 'stacks-config-missing-'))
    const missing = join(tempDir, 'config')

    expect(() => listConfigFiles(missing)).toThrow(
      `Could not list dashboard configuration: ${missing} does not exist`,
    )
  })
})
