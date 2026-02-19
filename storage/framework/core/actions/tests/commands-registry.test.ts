import { describe, expect, it } from 'bun:test'
import { existsSync } from 'node:fs'
import { appPath, commandsPath } from '@stacksjs/path'
import { get } from '@stacksjs/storage'

const registryPath = appPath('Commands.ts')

describe('Commands Registry (app/Commands.ts)', () => {

  it('should exist at app/Commands.ts', () => {
    expect(existsSync(registryPath)).toBe(true)
  })

  it('should export CommandConfig interface', async () => {
    const content = await get(registryPath)
    expect(content).toContain('export interface CommandConfig')
    expect(content).toContain('file: string')
    expect(content).toContain('enabled?: boolean')
    expect(content).toContain('aliases?: string[]')
  })

  it('should export CommandRegistry type', async () => {
    const content = await get(registryPath)
    expect(content).toContain('export type CommandRegistry')
    expect(content).toContain('Record<string, string | CommandConfig>')
  })

  it('should have a default export satisfying CommandRegistry', async () => {
    const content = await get(registryPath)
    expect(content).toContain('export default {')
    expect(content).toContain('} satisfies CommandRegistry')
  })

  it('should register the inspire command', async () => {
    const content = await get(registryPath)
    expect(content).toContain("'inspire': 'Inspire'")
  })

  it('should be importable and return a valid registry', async () => {
    const registryModule = await import(registryPath)
    const registry = registryModule.default

    expect(typeof registry).toBe('object')
    expect(registry).not.toBeNull()

    // Check that all entries are valid
    for (const [key, value] of Object.entries(registry)) {
      expect(typeof key).toBe('string')
      expect(key.length).toBeGreaterThan(0)

      if (typeof value === 'string') {
        expect(value.length).toBeGreaterThan(0)
      }
      else {
        expect((value as any).file).toBeDefined()
        expect(typeof (value as any).file).toBe('string')
      }
    }
  })
})

describe('Commands Directory (app/Commands/)', () => {
  it('should have an Inspire.ts command file', () => {
    const inspirePath = commandsPath('Inspire.ts')
    expect(existsSync(inspirePath)).toBe(true)
  })

  it('should have a valid default function export in Inspire.ts', async () => {
    const inspirePath = commandsPath('Inspire.ts')
    const module = await import(inspirePath)

    expect(typeof module.default).toBe('function')
  })

  it('command files referenced in registry should exist', async () => {
    const registryModule = await import(registryPath)
    const registry = registryModule.default

    for (const [signature, config] of Object.entries(registry)) {
      const fileName = typeof config === 'string' ? config : (config as any).file
      const filePath = commandsPath(`${fileName}.ts`)

      expect(existsSync(filePath)).toBe(true)
    }
  })
})

describe('Dynamic command imports', () => {
  it('should load and execute a command module', async () => {
    const inspirePath = commandsPath('Inspire.ts')
    const module = await import(inspirePath)

    // The default export should be a function that accepts a CLI instance
    expect(typeof module.default).toBe('function')

    // It should accept one argument (the CLI instance)
    expect(module.default.length).toBeLessThanOrEqual(1)
  })
})

describe('Command registration regex', () => {
  // Test the regex patterns used in make-command.ts registerCommand()
  const matchRegex = /export default \{([\s\S]*)\} satisfies/
  const replaceRegex = /export default \{[\s\S]*\} satisfies/

  it('should match a simple registry', () => {
    const content = `export default {
  'inspire': 'Inspire',
} satisfies CommandRegistry`

    const match = content.match(matchRegex)
    expect(match).not.toBeNull()
    expect(match![1]).toContain("'inspire': 'Inspire'")
  })

  it('should match a registry with config objects', () => {
    const content = `export default {
  'inspire': 'Inspire',
  'send-emails': {
    file: 'SendEmails',
    enabled: true,
    aliases: ['emails', 'mail'],
  },
} satisfies CommandRegistry`

    const match = content.match(matchRegex)
    expect(match).not.toBeNull()
    expect(match![1]).toContain("'send-emails'")
  })

  it('should match registry with comments containing braces', () => {
    const content = `/**
 * // With config
 * 'send-emails': {
 *   file: 'SendEmails',
 * },
 */
export default {
  'inspire': 'Inspire',
} satisfies CommandRegistry`

    const match = content.match(matchRegex)
    expect(match).not.toBeNull()
    expect(match![1]).toContain("'inspire': 'Inspire'")
  })

  it('should replace the registry block correctly', () => {
    const content = `export default {
  'inspire': 'Inspire',
} satisfies CommandRegistry`

    const newCommands = `\n  'inspire': 'Inspire',\n  'greet': 'Greet',\n`
    const updated = content.replace(
      replaceRegex,
      `export default {${newCommands}} satisfies`,
    )

    expect(updated).toContain("'greet': 'Greet'")
    expect(updated).toContain("'inspire': 'Inspire'")
    expect(updated).toContain('} satisfies')
  })
})
