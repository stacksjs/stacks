import { afterEach, describe, expect, it } from 'bun:test'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { cli } from '@stacksjs/cli'
import { aiContext, generateAiContextOutput } from '../src/commands/ai-context'
import { commandInventoryEntry } from '../src/commands/list'
import { shouldSkipAppKeyCheck } from '../src/project-setup'

const temporaryRoots: string[] = []

function project(): string {
  const root = mkdtempSync(join(tmpdir(), 'buddy-ai-context-'))
  temporaryRoots.push(root)
  mkdirSync(join(root, 'app/Models'), { recursive: true })
  writeFileSync(join(root, 'package.json'), JSON.stringify({ name: 'buddy-context-test' }))
  writeFileSync(join(root, 'app/Models/User.ts'), 'export default {}')
  return root
}

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) rmSync(root, { recursive: true, force: true })
})

describe('buddy ai:context', () => {
  it('registers JSON, output, budget, and model controls', () => {
    const buddy = cli('buddy')
    aiContext(buddy)
    const command = buddy.commands.find(candidate => candidate.namespace === 'ai' && candidate.name === 'context')
    const optionNames = command?.options.flatMap(option => option.names)

    expect(command && commandInventoryEntry(command).name).toBe('ai:context')
    expect(optionNames).toContain('json')
    expect(optionNames).toContain('output')
    expect(optionNames).toContain('maxChars')
    expect(optionNames).toContain('model')
  })

  it('emits the versioned JSON contract and writes it explicitly', () => {
    const root = project()
    const target = '.stacks/ai-context.json'
    const generated = generateAiContextOutput({ json: true, output: target, maxChars: 1000 }, root)
    const outputPath = join(root, target)

    expect(generated.outputPath).toBe(outputPath)
    expect(existsSync(outputPath)).toBeTrue()
    expect(JSON.parse(readFileSync(outputPath, 'utf8')).context.schemaVersion).toBe('1.0.0')
  })

  it('does not require an application key', () => {
    expect(shouldSkipAppKeyCheck('ai:context')).toBeTrue()
  })
})
