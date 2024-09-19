import { afterEach, beforeEach, describe, expect, it, mock, spyOn } from 'bun:test'
import { log } from '@stacksjs/logging'
import { ExitCode } from '@stacksjs/types'
import { CAC } from 'cac'
import {
  buddyOptions,
  cli,
  exec,
  execSync,
  installPackage,
  installStack,
  intro,
  outro,
  parseArgs,
  parseArgv,
  parseOptions,
  runCommand,
  runCommandSync,
  runCommands,
  spinner,
} from '../src'

mock.module('@stacksjs/logging', () => ({
  log: {
    debug: mock((...args: any[]) => {}),
    info: mock((...args: any[]) => {}),
    error: mock((...args: any[]) => {}),
    success: mock((...args: any[]) => {}),
    warn: mock((...args: any[]) => {}),
  },
}))

describe('@stacksjs/cli', () => {
  afterEach(() => {
    mock.restore()
  })

  describe('cli', () => {
    it('creates a CAC instance', () => {
      const instance = cli()
      expect(instance).toBeInstanceOf(CAC)
    })

    it('creates a CAC instance with custom name', () => {
      const instance = cli('custom-cli')
      expect(instance.name).toBe('custom-cli')
    })

    it('creates a CAC instance with options object', () => {
      const instance = cli({ name: 'option-cli' })
      expect(instance.name).toBe('option-cli')
    })
  })

  describe('parseArgv', () => {
    it('parses arguments and options', () => {
      const result = parseArgv(['command', '--option1', 'value1', '-a', 'value2'])
      expect(result).toEqual({
        args: ['command'],
        options: {
          option1: 'value1',
          a: 'value2',
        },
      })
    })

    it('handles boolean options', () => {
      const result = parseArgv(['command', '--flag', '--no-verbose'])
      expect(result).toEqual({
        args: ['command'],
        options: {
          flag: true,
          verbose: false,
        },
      })
    })
  })

  describe('parseArgs', () => {
    it('parses arguments', () => {
      const result = parseArgs(['command', '--option1', 'value1'])
      expect(result).toEqual(['command'])
    })
  })

  describe('parseOptions', () => {
    it('parses options', () => {
      process.argv = ['node', 'script.js', '--dry-run', '--verbose']
      const result = parseOptions()
      expect(result).toEqual({
        dryRun: true,
        quiet: false,
        verbose: true,
      })
    })
  })

  describe('buddyOptions', () => {
    it('returns options as a string', () => {
      const result = buddyOptions(['--dry-run', '--verbose'])
      expect(result).toBe('--dry-run --verbose')
    })
  })

  describe('runCommand', () => {
    it('runs a command', async () => {
      const result = await runCommand('echo test')
      expect(result.isOk()).toBe(true)
    })
  })

  describe('runCommandSync', () => {
    it('runs a command synchronously', async () => {
      const result = await runCommandSync('echo test')
      expect(result).toContain('test')
    })
  })

  describe('runCommands', () => {
    it('runs multiple commands', async () => {
      const results = await runCommands(['echo test1', 'echo test2'])
      expect(results.length).toBe(2)
      expect(results.every((r) => r.isOk())).toBe(true)
    })
  })

  describe('installPackage', () => {
    it('installs a package', async () => {
      const mockInstallPkg = mock(() => Promise.resolve())
      mock.module('@antfu/install-pkg', () => ({ installPackage: mockInstallPkg }))

      await installPackage('test-package')
      expect(mockInstallPkg).toHaveBeenCalledWith('test-package', { silent: true })
    })
  })

  describe('installStack', () => {
    it('installs a Stack', async () => {
      const mockInstallPkg = mock(() => Promise.resolve())
      mock.module('@antfu/install-pkg', () => ({ installPackage: mockInstallPkg }))

      await installStack('test-stack')
      expect(mockInstallPkg).toHaveBeenCalledWith('@stacksjs/test-stack', { silent: true })
    })
  })

  describe('intro', () => {
    it('prints intro message', async () => {
      const consoleSpy = spyOn(console, 'log')
      const result = await intro('test-command')
      expect(consoleSpy).toHaveBeenCalled()
      expect(typeof result).toBe('number')
    })
  })

  describe('outro', () => {
    it('prints outro message', async () => {
      const result = await outro('Test complete')
      expect(log.success).toHaveBeenCalled()
      expect(result).toBe(ExitCode.Success)
    })
  })

  describe('spinner', () => {
    it('creates a spinner', () => {
      const spin = spinner('Loading...')
      expect(spin).toHaveProperty('start')
      expect(spin).toHaveProperty('stop')
    })
  })

  describe('exec', () => {
    it('executes a command', async () => {
      const result = await exec('echo test')
      expect(result.isOk()).toBe(true)
    })
  })

  describe('execSync', () => {
    it('executes a command synchronously', async () => {
      const result = await execSync('echo test')
      expect(result).toContain('test')
    })
  })
})
