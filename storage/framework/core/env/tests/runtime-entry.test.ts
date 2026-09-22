import { describe, expect, test } from 'bun:test'
import { join, resolve } from 'node:path'
import process from 'node:process'
import * as root from '../src'
import * as runtime from '../src/runtime'

interface PublicProbeResult {
  rootLoadedBeforeRootImport: boolean
  rootLoadedAfterRootImport: boolean
  runtimeSourceLoaded: boolean
  runtimeDistLoaded: boolean
  databaseRuntimeSourceLoaded: boolean
  sameEnv: boolean
  sameProcess: boolean
  sameWriteEnv: boolean
  sameValidateEnv: boolean
  sameRequireEnv: boolean
}

const packageRoot = resolve(import.meta.dir, '..')
const repositoryRoot = resolve(packageRoot, '../../../..')
const config = join(repositoryRoot, 'bench/startup/bunfig.toml')

function childResult(fixture: string, args: string[] = []): Record<string, unknown> {
  const child = Bun.spawnSync([
    process.execPath,
    '--no-env-file',
    `--config=${config}`,
    join(import.meta.dir, 'fixtures', fixture),
    ...args,
  ], {
    cwd: repositoryRoot,
    env: {
      ...process.env,
      LOG_WRITE_TO_FILE: 'false',
      SKIP_CONFIG_LOADING: 'true',
    },
  })

  expect(child.exitCode).toBe(0)
  const lines = child.stdout.toString().trim().split('\n')
  return JSON.parse(lines.at(-1)!) as Record<string, unknown>
}

describe('env runtime entry', () => {
  test('shares the root runtime bindings', () => {
    expect(runtime.env).toBe(root.env)
    expect(runtime.process).toBe(root.process)
    expect(runtime.writeEnv).toBe(root.writeEnv)
    expect(runtime.validateEnv).toBe(root.validateEnv)
    expect(runtime.requireEnv).toBe(root.requireEnv)
  })

  test('public runtime imports resolve to one source instance', () => {
    expect(childResult('public-runtime-entry-probe.ts')).toEqual({
      rootLoadedBeforeRootImport: false,
      rootLoadedAfterRootImport: true,
      runtimeSourceLoaded: true,
      runtimeDistLoaded: false,
      databaseRuntimeSourceLoaded: true,
      sameEnv: true,
      sameProcess: true,
      sameWriteEnv: true,
      sameValidateEnv: true,
      sameRequireEnv: true,
    } satisfies PublicProbeResult)
  })

  test('built public entries share runtime and plugin state', () => {
    const build = Bun.spawnSync([process.execPath, 'run', 'build'], {
      cwd: packageRoot,
      env: process.env,
    })
    expect(build.exitCode).toBe(0)

    expect(childResult('built-runtime-entry-probe.ts', [
      join(packageRoot, 'dist/index.js'),
      join(packageRoot, 'dist/runtime.js'),
      join(packageRoot, 'dist/plugin.js'),
    ])).toEqual({
      sameEnv: true,
      sameProcess: true,
      sameWriteEnv: true,
      sameValidateEnv: true,
      sameRequireEnv: true,
      sameActiveEnvName: true,
    })
  })
})
