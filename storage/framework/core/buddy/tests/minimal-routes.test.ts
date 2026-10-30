import { afterEach, describe, expect, it } from 'bun:test'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { ensureAuthRoutesEnv } from '../src/minimal-routes'

const made: string[] = []
const app = (files: Record<string, string>) => {
  const dir = mkdtempSync(join(tmpdir(), 'minimal-routes-'))
  made.push(dir)
  for (const [name, contents] of Object.entries(files)) writeFileSync(join(dir, name), contents)
  return dir
}

afterEach(() => {
  for (const dir of made.splice(0)) rmSync(dir, { recursive: true, force: true })
})

describe('ensureAuthRoutesEnv', () => {
  it('names the auth bundle in .env.example and .env', () => {
    const dir = app({ '.env.example': 'APP_NAME=x\n', '.env': 'APP_NAME=x' })
    expect(ensureAuthRoutesEnv(dir)).toEqual(['.env.example', '.env'])
    expect(readFileSync(join(dir, '.env'), 'utf8')).toContain('\nSTACKS_DEFAULT_ROUTES=auth\n')
  })

  it('leaves an app that already chose its bundles alone', () => {
    const dir = app({ '.env.example': 'STACKS_DEFAULT_ROUTES=all\n' })
    expect(ensureAuthRoutesEnv(dir)).toEqual([])
    expect(readFileSync(join(dir, '.env.example'), 'utf8')).toBe('STACKS_DEFAULT_ROUTES=all\n')
  })

  it('is idempotent and tolerates a missing .env', () => {
    const dir = app({ '.env.example': 'A=1\n' })
    expect(ensureAuthRoutesEnv(dir)).toEqual(['.env.example'])
    expect(ensureAuthRoutesEnv(dir)).toEqual([])
  })
})
