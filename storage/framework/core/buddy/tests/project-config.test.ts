import { afterEach, describe, expect, it } from 'bun:test'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { loadProjectDnsConfig } from '../src/config'

const originalCwd = process.cwd()
let projectDir = ''

afterEach(() => {
  process.chdir(originalCwd)
  if (projectDir) rmSync(projectDir, { recursive: true, force: true })
})

describe('project configuration', () => {
  it('loads the consumer DNS config instead of framework defaults', async () => {
    projectDir = mkdtempSync(join(tmpdir(), 'stacks-dns-config-'))
    mkdirSync(join(projectDir, 'config'))
    writeFileSync(join(projectDir, 'config/dns.ts'), `export default { a: [{ name: '@', address: '203.0.113.10' }] }\n`)
    process.chdir(projectDir)

    const loaded = await loadProjectDnsConfig({ a: [] })

    expect(loaded.a).toEqual([{ name: '@', address: '203.0.113.10' }])
  })
})
