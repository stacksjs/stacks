/* eslint perfectionist/sort-imports: 0 */
import { ExitCode } from '@stacksjs/types'
import { describe, expect, it } from 'bun:test'
import { CLI } from '@stacksjs/clapp'
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

describe('@stacksjs/cli', () => {
  describe('cli', () => {
    it('creates a CLI instance', () => {
      const instance = cli()
      expect(instance).toBeInstanceOf(CLI)
    })

    it('creates a CLI instance with custom name', () => {
      const instance = cli('custom-cli')
      expect(instance.name).toBe('custom-cli')
    })

    it('creates a CLI instance with options object', () => {
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

  describe('function exports', () => {
    it('runCommand is exported as a function', () => {
      expect(typeof runCommand).toBe('function')
    })

    it('runCommandSync is exported as a function', () => {
      expect(typeof runCommandSync).toBe('function')
    })

    it('runCommands is exported as a function', () => {
      expect(typeof runCommands).toBe('function')
    })

    it('exec is exported as a function', () => {
      expect(typeof exec).toBe('function')
    })

    it('execSync is exported as a function', () => {
      expect(typeof execSync).toBe('function')
    })
  })

  describe('installPackage', () => {
    it('is exported as a function', () => {
      expect(typeof installPackage).toBe('function')
    })
  })

  describe('installStack', () => {
    it('is exported as a function', () => {
      expect(typeof installStack).toBe('function')
    })
  })

  describe('intro', () => {
    it('is exported as a function', () => {
      expect(typeof intro).toBe('function')
    })
  })

  describe('outro', () => {
    it('is exported as a function', () => {
      expect(typeof outro).toBe('function')
    })
  })

  describe('spinner', () => {
    it('creates a spinner', () => {
      const spin = spinner('Loading...')
      expect(spin).toHaveProperty('start')
      expect(spin).toHaveProperty('stop')
    })
  })
})
