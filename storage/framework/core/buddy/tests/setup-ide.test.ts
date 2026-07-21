import { afterEach, describe, expect, it } from 'bun:test'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { ensureIdeSettings } from '../src/commands/setup'

const roots: string[] = []

afterEach(() => {
  for (const root of roots.splice(0))
    rmSync(root, { recursive: true, force: true })
})

describe('setup IDE settings', () => {
  it('installs the bundled VS Code project settings', () => {
    const root = mkdtempSync(join(tmpdir(), 'stacks-setup-'))
    roots.push(root)

    ensureIdeSettings(root)

    expect(existsSync(join(root, '.vscode', 'settings.json'))).toBe(true)
    expect(existsSync(join(root, '.vscode', 'extensions.json'))).toBe(true)
  })

  it('never overwrites existing project settings', () => {
    const root = mkdtempSync(join(tmpdir(), 'stacks-setup-'))
    const ideDir = join(root, '.vscode')
    roots.push(root)
    mkdirSync(ideDir)
    writeFileSync(join(ideDir, 'settings.json'), '{"custom":true}\n')

    ensureIdeSettings(root)

    expect(readFileSync(join(ideDir, 'settings.json'), 'utf8')).toBe('{"custom":true}\n')
  })
})
