import { describe, expect, it } from 'bun:test'
import { Action, NpmScript } from '../src/index'

describe('@stacksjs/enums', () => {
  describe('Action enum', () => {
    it('has Bump value', () => {
      expect(Action.Bump).toBeDefined()
    })

    it('Bump value is a string', () => {
      expect(typeof Action.Bump).toBe('string')
    })

    it('has Dev value', () => {
      expect(Action.Dev).toBe('dev/views')
    })

    it('has DevApi value', () => {
      expect(Action.DevApi).toBe('dev/api')
    })

    it('has Clean value', () => {
      expect(Action.Clean).toBe('clean')
    })

    it('has Release value', () => {
      expect(Action.Release).toBe('release')
    })

    it('has Test value', () => {
      expect(Action.Test).toBe('test/index')
    })

    it('has Migrate value', () => {
      expect(Action.Migrate).toBe('migrate/database')
    })
  })

  describe('NpmScript enum', () => {
    it('has Build value', () => {
      expect(NpmScript.Build).toBeDefined()
    })

    it('Build value is a string', () => {
      expect(typeof NpmScript.Build).toBe('string')
      expect(NpmScript.Build).toBe('build')
    })

    it('has Dev value', () => {
      expect(NpmScript.Dev).toBe('dev')
    })

    it('has Test value', () => {
      expect(NpmScript.Test).toBe('bun test ./tests/feature/** ./tests/unit/**')
    })

    it('has Lint value', () => {
      expect(NpmScript.Lint).toBeDefined()
      expect(typeof NpmScript.Lint).toBe('string')
    })

    it('has Fresh value', () => {
      expect(NpmScript.Fresh).toBe('fresh')
    })

    it('has Release value', () => {
      expect(NpmScript.Release).toBe('release')
    })

    it('has Clean value', () => {
      expect(NpmScript.Clean).toBeDefined()
      expect(typeof NpmScript.Clean).toBe('string')
    })
  })
})
