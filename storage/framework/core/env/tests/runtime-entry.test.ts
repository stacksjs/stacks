import { describe, expect, test } from 'bun:test'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import process from 'node:process'
import * as root from '../src'
import { encryptValue, generateKeypair } from '../src/crypto'
import * as runtime from '../src/runtime'

interface PublicProbeResult {
  rootLoadedBeforeRootImport: boolean
  rootLoadedAfterRootImport: boolean
  runtimeSourceLoaded: boolean
  runtimeDistLoaded: boolean
  databaseRuntimeSourceLoaded: boolean
  decryptionSupportLoadedBeforeRootImport: boolean
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
      decryptionSupportLoadedBeforeRootImport: false,
      sameEnv: true,
      sameProcess: true,
      sameWriteEnv: true,
      sameValidateEnv: true,
      sameRequireEnv: true,
    } satisfies PublicProbeResult)
  })

  test('loads decryption support on the first encrypted proxy read', () => {
    const keys = generateKeypair()
    const ciphertext = encryptValue('runtime-secret', keys.publicKey)

    expect(childResult('runtime-lazy-decryption-probe.ts', ['@stacksjs/env/runtime', ciphertext, keys.privateKey])).toEqual({
      supportLoadedBeforeRead: false,
      supportLoadedAfterRead: true,
      decrypted: 'runtime-secret',
    })
  })

  test('built public entries share runtime and plugin state', () => {
    const build = Bun.spawnSync([process.execPath, 'run', 'build'], {
      cwd: packageRoot,
      env: process.env,
    })
    expect(build.exitCode).toBe(0)

    const rootEntry = join(packageRoot, 'dist/index.js')
    const runtimeEntry = join(packageRoot, 'dist/runtime.js')
    const pluginEntry = join(packageRoot, 'dist/plugin.js')
    expect(childResult('built-runtime-entry-probe.ts', [rootEntry, runtimeEntry, pluginEntry])).toEqual({
      sameEnv: true,
      sameProcess: true,
      sameWriteEnv: true,
      sameValidateEnv: true,
      sameRequireEnv: true,
      sameActiveEnvName: true,
    })

    const keys = generateKeypair()
    const ciphertext = encryptValue('built-runtime-secret', keys.publicKey)
    expect(childResult('runtime-lazy-decryption-probe.ts', [runtimeEntry, ciphertext, keys.privateKey])).toEqual({
      supportLoadedBeforeRead: false,
      supportLoadedAfterRead: true,
      decrypted: 'built-runtime-secret',
    })
  })

  test('bundles synchronous decryption support for standalone consumers', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'stacks-env-runtime-bundle-'))
    try {
      const build = await Bun.build({
        entrypoints: [join(packageRoot, 'src/runtime.ts')],
        target: 'bun',
        format: 'esm',
        write: false,
        metafile: true,
      })
      expect(build.success).toBe(true)
      expect(Object.keys(build.metafile?.inputs || {}).some(source => source.endsWith('/env/src/plugin.ts'))).toBe(true)
      expect(build.outputs).toHaveLength(1)

      const entry = join(directory, 'runtime.js')
      await Bun.write(entry, build.outputs[0]!)
      const keys = generateKeypair()
      const ciphertext = encryptValue('bundled-runtime-secret', keys.publicKey)
      expect(childResult('bundled-runtime-decryption-probe.ts', [entry, ciphertext, keys.privateKey])).toEqual({
        decrypted: 'bundled-runtime-secret',
      })
    }
    finally {
      rmSync(directory, { recursive: true, force: true })
    }
  })
})
