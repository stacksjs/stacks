import { afterEach, describe, expect, it, mock } from 'bun:test'
import { existsSync, unlinkSync } from 'node:fs'

// Mock logging to prevent process hanging
mock.module('@stacksjs/logging', () => ({
  log: {
    debug: () => {},
    info: () => {},
    warn: () => {},
    error: () => {},
    success: () => {},
  },
}))

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

      // Should have proper imports
      expect(content).toContain("import type { CLI } from '@stacksjs/types'")
      expect(content).toContain("import { log } from '@stacksjs/cli'")
      expect(content).toContain("import { ExitCode } from '@stacksjs/types'")

      // Should have default function export
      expect(content).toContain('export default function (cli: CLI)')

      // Should use kebab-case for the command signature
      expect(content).toContain("command('generate-report'")

      // Should have the command name in the interface
      expect(content).toContain('interface GenerateReportOptions')
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
      expect(content).toContain("command('custom:cmd'")
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
      expect(content).toContain("option('--verbose'")
    })

    it('should handle unknown subcommands', async () => {
      await makeCommand({
        name: 'SubCmd',
        register: false,
      })

      const filePath = p.commandsPath('SubCmd.ts')
      createdFiles.push(filePath)

      const content = await get(filePath)
      expect(content).toContain("cli.on('sub-cmd:*'")
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
      expect(content).toContain("command('send-notification'")
    })

    it('should convert snake_case to PascalCase for filenames', async () => {
      await makeCommand({ name: 'run_migrations', register: false })
      const filePath = p.commandsPath('RunMigrations.ts')
      createdFiles.push(filePath)
      expect(existsSync(filePath)).toBe(true)
    })
  })
})
