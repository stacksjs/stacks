import { describe, expect, it } from 'bun:test'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { declaredPantryRange, declaredPantryWorkflowVersions, parsePantryVersion, resolvePantryToolchain } from '../src/pantry-toolchain'

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
  it('rejects an older CI publisher even when the local executable satisfies the SDK', () => {
    const { cwd, done } = workspace({
      ...framework,
      'storage/framework/core/buddy/package.json': { dependencies: { 'ts-pantry': '^0.11.130' } },
    })
    const workflow = join(cwd, '.github/workflows/release.yml')
    mkdirSync(join(workflow, '..'), { recursive: true })
    writeFileSync(workflow, 'jobs:\n  npm:\n    steps:\n      - uses: pantry-pm/pantry/packages/action@old\n        with:\n          version: 0.11.127\n')
    try {
      const options = { cwd, env: {}, probe: answers('pantry 0.11.130') }
      const result = resolvePantryToolchain(options)
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.message).toContain('release.yml (npm): 0.11.127')
        expect(result.message).toContain('before any file changed')
      }
      writeFileSync(workflow, 'jobs:\n  npm:\n    steps:\n      - uses: pantry-pm/pantry/packages/action@qualified\n        with:\n          version: 0.11.130\n')
      expect(resolvePantryToolchain(options).ok).toBe(true)
    }
    finally { done() }
  })

  it('keeps the actual source and release workflows compatible with the declared SDK', () => {
    const root = resolve(import.meta.dir, '../../../../..')
    const declared = declaredPantryRange(root)
    expect(declared).toBeDefined()
    const pins = declaredPantryWorkflowVersions(root)
    expect(pins.some(pin => pin.file.endsWith('ci.yml'))).toBe(true)
    expect(pins.some(pin => pin.file.endsWith('release.yml') && pin.job === 'npm')).toBe(true)
    for (const pin of pins)
      expect(Bun.semver.satisfies(pin.version, declared!.range), `${pin.file} (${pin.job}) uses Pantry ${pin.version}`).toBe(true)
  })

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

  it('lets publishers select the same bare PATH executable they invoke', () => {
    const { cwd, done } = workspace(framework)
    try {
      const asked: string[] = []
      const toolchain = resolvePantryToolchain({ cwd, allowOverride: false, env: { PANTRY_BIN: '/local/release/pantry' }, probe: bin => {
        asked.push(bin)
        return { exitCode: 0, stdout: 'pantry 0.11.103' }
      } })
      expect(toolchain.ok).toBe(true)
      expect(asked).toEqual(['pantry'])
    }
    finally { done() }
  })

  it('gives PATH-only recovery guidance when a publisher cannot use an override', () => {
    const { cwd, done } = workspace(framework)
    try {
      for (const probe of [answers('pantry 0.11.80'), answers('', 127)]) {
        const toolchain = resolvePantryToolchain({ cwd, allowOverride: false, env: { PANTRY_BIN: '/qualified/pantry' }, probe })
        expect(toolchain.ok).toBe(false)
        if (!toolchain.ok) {
          expect(toolchain.message).toContain('PATH')
          expect(toolchain.message).not.toContain('Set PANTRY_BIN')
          expect(toolchain.message).not.toContain('set PANTRY_BIN')
        }
      }
    }
    finally { done() }
  })
})
