import { afterEach, expect, test } from 'bun:test'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { loadEnv } from '../src/plugin'

const KEYS = ['PRELOAD_ENDPOINT', 'PRELOAD_URL', 'PRELOAD_SHELL']
const dirs: string[] = []

function fixture(): string {
  const dir = mkdtempSync(join(tmpdir(), 'stacks-env-preload-'))
  dirs.push(dir)
  writeFileSync(join(dir, '.env'), 'PRELOAD_ENDPOINT=\nPRELOAD_URL=http://localhost:3000\nPRELOAD_SHELL=from-base\n')
  writeFileSync(join(dir, '.env.preload_fixture'), 'PRELOAD_ENDPOINT=https://storage.example.invalid\nPRELOAD_URL=https://app.example.invalid\nPRELOAD_SHELL=from-environment\n')
  return dir
}

afterEach(() => {
  for (const key of KEYS) delete process.env[key]
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true })
})

test('a base .env value Bun preloaded does not shadow the environment file', () => {
  const dir = fixture()
  // What Bun's own loader leaves behind before any Stacks code runs.
  process.env.PRELOAD_ENDPOINT = ''
  process.env.PRELOAD_URL = 'http://localhost:3000'

  loadEnv({ path: ['.env', '.env.preload_fixture'], cwd: dir, env: 'preload_fixture', quiet: true })

  expect(process.env.PRELOAD_ENDPOINT).toBe('https://storage.example.invalid')
  expect(process.env.PRELOAD_URL).toBe('https://app.example.invalid')
})

test('a shell export that differs from the base file still wins over every file', () => {
  const dir = fixture()
  process.env.PRELOAD_SHELL = 'from-shell'

  loadEnv({ path: ['.env', '.env.preload_fixture'], cwd: dir, env: 'preload_fixture', quiet: true })

  expect(process.env.PRELOAD_SHELL).toBe('from-shell')
})
