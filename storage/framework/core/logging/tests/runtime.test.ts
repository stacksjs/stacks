import { describe, expect, it } from 'bun:test'
import { join, resolve } from 'node:path'
import process from 'node:process'

interface ProbeResult {
  before: boolean
  after: boolean
}

const repositoryRoot = resolve(import.meta.dir, '../../../../..')
const config = join(repositoryRoot, 'bench/startup/bunfig.toml')
const fixture = join(import.meta.dir, 'fixtures/runtime-probe.ts')

function probe(mode: string, level?: string): ProbeResult {
  const env = { ...process.env, LOG_WRITE_TO_FILE: 'false' }
  if (level) env.LOG_LEVEL = level
  else delete env.LOG_LEVEL

  const child = Bun.spawnSync([
    process.execPath,
    '--no-env-file',
    `--config=${config}`,
    fixture,
    mode,
  ], { cwd: repositoryRoot, env })

  expect(child.exitCode).toBe(0)
  const lines = child.stdout.toString().trim().split('\n')
  return JSON.parse(lines.at(-1)!) as ProbeResult
}

describe('logging runtime facade', () => {
  it('keeps a default suppressed debug call on the narrow entry', () => {
    expect(probe('quiet')).toEqual({ before: false, after: false })
  })

  it('keeps resolved and pending info-level config on the narrow entry', () => {
    expect(probe('resolved-info')).toEqual({ before: false, after: false })
    expect(probe('pending-info')).toEqual({ before: false, after: false })
  })

  it('loads the implementation for configured debug output', () => {
    expect(probe('resolved-debug')).toEqual({ before: false, after: true })
    expect(probe('quiet', 'debug')).toEqual({ before: false, after: true })
  })

  it('loads the implementation for emitted records', () => {
    expect(probe('warn')).toEqual({ before: false, after: true })
  })
})
