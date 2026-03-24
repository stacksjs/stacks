import { describe, expect, it } from 'bun:test'

describe('Buddy CLI Module', () => {
  describe('exports', () => {
    it('should export commands module', async () => {
      const commands = await import('../src/commands/index')
      expect(commands).toBeDefined()
    })

    it('should export the about command', async () => {
      const { about } = await import('../src/commands/about')
      expect(about).toBeFunction()
    })

    it('should export the build command', async () => {
      const { build } = await import('../src/commands/build')
      expect(build).toBeFunction()
    })

    it('should export the dev command', async () => {
      const { dev } = await import('../src/commands/dev')
      expect(dev).toBeFunction()
    })

    it('should export the types command', async () => {
      const { types } = await import('../src/commands/types')
      expect(types).toBeFunction()
    })

    it('should export the version command', async () => {
      const { version } = await import('../src/commands/version')
      expect(version).toBeFunction()
    })

    it('should export the lint command', async () => {
      const { lint } = await import('../src/commands/lint')
      expect(lint).toBeFunction()
    })
  })

  describe('Command registration structure', () => {
    it('each command export should be a function that accepts a CLI argument', async () => {
      // Commands follow the pattern: export function commandName(buddy: CLI): void
      const { types } = await import('../src/commands/types')
      // The function signature expects a CLI object; verify it has length 1
      expect(types.length).toBe(1)
    })

    it('should export many distinct command modules', async () => {
      const commands = await import('../src/commands/index')
      const exportedKeys = Object.keys(commands)
      // There should be a large number of command exports
      expect(exportedKeys.length).toBeGreaterThan(20)
    })
  })
})
