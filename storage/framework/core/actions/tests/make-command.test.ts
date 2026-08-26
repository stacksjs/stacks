import { afterEach, describe, expect, it } from 'bun:test'
import { existsSync, unlinkSync } from 'node:fs'

const { makeCommand } = await import('../src/make-command')
const p = await import('@stacksjs/path')
const { get } = await import('@stacksjs/storage')

// Track created files for cleanup
const createdFiles: string[] = []

function cleanup() {
  for (const file of createdFiles) {
    try {
      if (existsSync(file)) unlinkSync(file)
    }
    catch {}
  }
  createdFiles.length = 0
}

afterEach(cleanup)

describe('makeCommand', () => {
  describe('command creation', () => {
    it('should create a command file', async () => {
      const result = await makeCommand({
        name: 'TestMakeCmd',
        register: false,
      })

      const filePath = p.commandsPath('TestMakeCmd.ts')
      createdFiles.push(filePath)

      expect(result).toBe(true)
      expect(existsSync(filePath)).toBe(true)
    })

    it('should return false when name is missing', async () => {
      const result = await makeCommand({
        name: '',
        register: false,
      })

      expect(result).toBe(false)
    })

    it('should PascalCase the command name', async () => {
      const result = await makeCommand({
        name: 'send-emails',
        register: false,
      })

      const filePath = p.commandsPath('SendEmails.ts')
      createdFiles.push(filePath)

      expect(result).toBe(true)
      expect(existsSync(filePath)).toBe(true)
    })

    it('should handle underscore-separated names', async () => {
      const result = await makeCommand({
        name: 'process_data',
        register: false,
      })

      const filePath = p.commandsPath('ProcessData.ts')
      createdFiles.push(filePath)

      expect(result).toBe(true)
      expect(existsSync(filePath)).toBe(true)
    })
  })

  describe('generated content', () => {
    it('should generate valid TypeScript with CLI setup', async () => {
      await makeCommand({
        name: 'GenerateReport',
        register: false,
      })

      const filePath = p.commandsPath('GenerateReport.ts')
      createdFiles.push(filePath)

      const content = await get(filePath)

      // Should import the typed authoring helper
      expect(content).toContain("import { defineCommand, log } from '@stacksjs/cli'")

      // Should default-export a definition, not a bare function
      expect(content).toContain('export default defineCommand({')

      // Should use kebab-case for the command signature
      expect(content).toContain("name: 'generate-report'")

      // Options are inferred from the flags, so there is no hand-written interface
      expect(content).not.toContain('interface GenerateReportOptions')
      expect(content).toContain('async handle(options)')
    })

    it('should use custom signature when provided', async () => {
      await makeCommand({
        name: 'MyCommand',
        signature: 'custom:cmd',
        register: false,
      })

      const filePath = p.commandsPath('MyCommand.ts')
      createdFiles.push(filePath)

      const content = await get(filePath)
      expect(content).toContain("name: 'custom:cmd'")
    })

    it('should use custom description when provided', async () => {
      await makeCommand({
        name: 'DocCmd',
        description: 'Generates documentation',
        register: false,
      })

      const filePath = p.commandsPath('DocCmd.ts')
      createdFiles.push(filePath)

      const content = await get(filePath)
      expect(content).toContain('Generates documentation')
    })

    it('should include verbose option by default', async () => {
      await makeCommand({
        name: 'VerboseCmd',
        register: false,
      })

      const filePath = p.commandsPath('VerboseCmd.ts')
      createdFiles.push(filePath)

      const content = await get(filePath)
      expect(content).toContain("'--verbose': { description: 'Enable verbose output', default: false }")
    })

    it('should read the declared option in the handler', async () => {
      await makeCommand({
        name: 'SubCmd',
        register: false,
      })

      const filePath = p.commandsPath('SubCmd.ts')
      createdFiles.push(filePath)

      const content = await get(filePath)
      expect(content).toContain('if (options.verbose)')
    })
  })

  describe('registration', () => {
    // The registry is optional now: a command file is live on disk. Creating
    // one where the project has none would put the generated file back.
    it('does not create app/Commands.ts when the project has none', async () => {
      const registryPath = p.appPath('Commands.ts')

      if (existsSync(registryPath))
        return

      await makeCommand({ name: 'NoRegistryCmd' })
      createdFiles.push(p.commandsPath('NoRegistryCmd.ts'))

      expect(existsSync(registryPath)).toBe(false)
    })
  })

  describe('name conversion', () => {
    it('should convert kebab-case to PascalCase for filenames', async () => {
      await makeCommand({ name: 'my-great-command', register: false })
      const filePath = p.commandsPath('MyGreatCommand.ts')
      createdFiles.push(filePath)
      expect(existsSync(filePath)).toBe(true)
    })

    it('should convert PascalCase to kebab-case for signatures', async () => {
      await makeCommand({ name: 'SendNotification', register: false })
      const filePath = p.commandsPath('SendNotification.ts')
      createdFiles.push(filePath)

      const content = await get(filePath)
      expect(content).toContain("name: 'send-notification'")
    })

    it('should convert snake_case to PascalCase for filenames', async () => {
      await makeCommand({ name: 'run_migrations', register: false })
      const filePath = p.commandsPath('RunMigrations.ts')
      createdFiles.push(filePath)
      expect(existsSync(filePath)).toBe(true)
    })
  })
})
