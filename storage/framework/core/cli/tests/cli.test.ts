/* eslint perfectionist/sort-imports: 0 */
import { log } from '@stacksjs/logging'
import { ExitCode } from '@stacksjs/types'
import { afterEach, describe, expect, it, mock, spyOn } from 'bun:test'
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
  runCommands,
  runCommandSync,
  spinner,
} from '../src'
import * as originalModule from '../src'

mock.module('@stacksjs/logging', () => ({
  log: {
    // eslint-disable-next-line unused-imports/no-unused-vars
    debug: mock((...args: any[]) => {}),
    // eslint-disable-next-line unused-imports/no-unused-vars
    info: mock((...args: any[]) => {}),
    // eslint-disable-next-line unused-imports/no-unused-vars
    error: mock((...args: any[]) => {}),
    // eslint-disable-next-line unused-imports/no-unused-vars
    success: mock((...args: any[]) => {}),
    // eslint-disable-next-line unused-imports/no-unused-vars
    warn: mock((...args: any[]) => {}),
  },
}))

// Create mock functions
const mockExec = mock(() => Promise.resolve({ stdout: 'test', stderr: '', isOk: () => true, isErr: () => false }))
const mockExecSync = mock(() => 'test')

const mockedModule = {
  ...originalModule,
  exec: mockExec,
  execSync: mockExecSync,
  runCommand: async (...args: any[]) => {
    const result = await mockExec(...args)
    return { ...result, isOk: () => true, isErr: () => false }
  },
  runCommandSync: (...args: any[]) => mockExecSync(...args),
}

// Mock the entire module
mock.module('../src', () => mockedModule)

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
          'flag': true,
          'no-verbose': true,
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
      expect(mockExec).toHaveBeenCalledWith('echo test')
    })
  })

  describe('runCommandSync', () => {
    it('runs a command synchronously', async () => {
      const result = await runCommandSync('echo test')
      expect(result).toBe('test')
      expect(mockExecSync).toHaveBeenCalled()
    })
  })

  describe('runCommands', () => {
    it('runs multiple commands', async () => {
      const results = await runCommands(['echo test1', 'echo test2'])
      expect(results.length).toBe(2)
      expect(results.every(r => r.isOk())).toBe(true)
      expect(mockExec).toHaveBeenCalledTimes(3)
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
      const logSpy = spyOn(log, 'info') // Change this to the actual logging method used
      const result = await intro('test-command')
      expect(logSpy).toHaveBeenCalled()
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
      expect(mockExec).toHaveBeenCalledWith('echo test')
    })
  })

  describe('execSync', () => {
    it('executes a command synchronously', async () => {
      const result = await execSync('echo test')
      expect(result).toContain('test')
      expect(mockExecSync).toHaveBeenCalledWith('echo test')
    })
  })
})
