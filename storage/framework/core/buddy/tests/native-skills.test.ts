import { describe, expect, it } from 'bun:test'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { nativePackageCatalog, renderDriverCapabilities, renderNativeCatalog } from '../src/commands/docs/native-skills'

const root = new URL('../../../../../', import.meta.url).pathname
const skillRoot = join(root, 'storage/framework/defaults/ai/skills')

describe('native skill discovery coverage', () => {
  it('covers every core package with a real skill and source pointer', () => {
    const packages = nativePackageCatalog()
    expect(packages.length).toBeGreaterThan(80)
    for (const entry of packages) {
      expect(existsSync(join(skillRoot, entry.skill, 'SKILL.md'))).toBe(true)
      expect(existsSync(join(root, entry.entry))).toBe(true)
      for (const path of [...entry.dependencies, ...entry.tests])
        expect(existsSync(join(root, path))).toBe(true)
    }
    expect(packages.find(entry => entry.name === '@stacksjs/forms')?.skill).toBe('stacks-forms')
    expect(packages.find(entry => entry.name === '@stacksjs/action-runner')?.skill).toBe('stacks-actions')
  })

  it('fails when a new package has no task guidance instead of silently omitting it', () => {
    const fixture = mkdtempSync(join(tmpdir(), 'stacks-native-coverage-'))
    try {
      const packageRoot = join(fixture, 'storage/framework/core/new-native-package')
      mkdirSync(packageRoot, { recursive: true })
      writeFileSync(join(packageRoot, 'package.json'), '{"name":"@stacksjs/new-native-package"}')
      expect(() => nativePackageCatalog(fixture)).toThrow('needs a skill')
    }
    finally {
      rmSync(fixture, { recursive: true, force: true })
    }
  })

  it('keeps generated guidance current with real source exports and driver evidence', () => {
    expect(readFileSync(join(skillRoot, 'stacks-native/CATALOG.md'), 'utf8')).toBe(renderNativeCatalog())
    const drivers = renderDriverCapabilities()
    expect(readFileSync(join(skillRoot, 'stacks-native/CAPABILITIES.md'), 'utf8')).toBe(drivers)
    expect(drivers).toContain('## queue: sqs\n\nStatus: **unsupported**')
    expect(drivers).toContain('## storage: azure\n\nStatus: **partial**')
    expect(drivers).toContain('not a live container round trip')
  })
})
