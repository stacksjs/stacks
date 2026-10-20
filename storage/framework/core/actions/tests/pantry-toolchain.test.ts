import { describe, expect, it } from 'bun:test'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { declaredPantryRange, parsePantryVersion, resolvePantryToolchain } from '../src/pantry-toolchain'

function workspace(manifests: Record<string, object>): { cwd: string, done: () => void } {
  const cwd = mkdtempSync(join(tmpdir(), 'pantry-toolchain-'))
  for (const [file, manifest] of Object.entries(manifests)) {
    mkdirSync(join(cwd, file, '..'), { recursive: true })
    writeFileSync(join(cwd, file), JSON.stringify(manifest))
  }
  return { cwd, done: () => rmSync(cwd, { recursive: true, force: true }) }
}

const framework = {
  'package.json': { name: 'stacks' },
  'storage/framework/core/buddy/package.json': { name: '@stacksjs/buddy', dependencies: { 'ts-pantry': '^0.11.103' } },
}

const answers = (output: string, exitCode = 0) => () => ({ exitCode, stdout: output })

describe('the Pantry a release regenerates pantry.lock with', () => {
  it('reads the version a Pantry CLI reports', () => {
    expect(parsePantryVersion('pantry 0.11.103 (986749281)')).toBe('0.11.103')
    expect(parsePantryVersion('pantry v0.11.80\n')).toBe('0.11.80')
    expect(parsePantryVersion('command not found')).toBeUndefined()
  })

  it('takes the declared range from buddy in the framework, and from the root manifest in an app', () => {
    const fw = workspace(framework)
    const app = workspace({ 'package.json': { name: 'app', devDependencies: { 'ts-pantry': '^0.11.90' } } })
    try {
      expect(declaredPantryRange(fw.cwd)).toEqual({ range: '^0.11.103', file: 'storage/framework/core/buddy/package.json' })
      expect(declaredPantryRange(app.cwd)).toEqual({ range: '^0.11.90', file: 'package.json' })
    }
    finally {
      fw.done()
      app.done()
    }
  })

  it('refuses a global Pantry older than the declared one, before anything changes', () => {
    const { cwd, done } = workspace(framework)
    try {
      const toolchain = resolvePantryToolchain({ cwd, env: {}, probe: answers('pantry 0.11.80 (36199c0e4)') })
      expect(toolchain.ok).toBe(false)
      if (!toolchain.ok) {
        expect(toolchain.message).toContain('Pantry 0.11.80')
        expect(toolchain.message).toContain('ts-pantry ^0.11.103')
        expect(toolchain.message).toContain('PANTRY_BIN')
      }
    }
    finally {
      done()
    }
  })

  it('accepts the declared Pantry, preferring PANTRY_BIN to whatever is on PATH', () => {
    const { cwd, done } = workspace(framework)
    try {
      const asked: string[] = []
      const toolchain = resolvePantryToolchain({
        cwd,
        env: { PANTRY_BIN: '/qualified/pantry' },
        probe: (bin) => {
          asked.push(bin)
          return { exitCode: 0, stdout: 'pantry 0.11.103 (986749281)' }
        },
      })
      expect(asked).toEqual(['/qualified/pantry'])
      expect(toolchain).toEqual({ ok: true, bin: '/qualified/pantry', version: '0.11.103', declared: '^0.11.103', declaredIn: 'storage/framework/core/buddy/package.json' })
    }
    finally {
      done()
    }
  })

  it('refuses a Pantry it cannot run, since the lock it would write is unknown', () => {
    const { cwd, done } = workspace(framework)
    try {
      const toolchain = resolvePantryToolchain({ cwd, env: {}, probe: answers('', 127) })
      expect(toolchain.ok).toBe(false)
      if (!toolchain.ok)
        expect(toolchain.message).toContain('could not run `pantry --version`')
    }
    finally {
      done()
    }
  })
})
