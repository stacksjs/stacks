import { expect, test } from 'bun:test'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import process from 'node:process'

interface ProbeResult {
  before: boolean
  after: boolean
  routerRootLoaded: boolean
  routerRuntimeLoaded: boolean
  configRootLoadedBeforeCall: boolean
  configRuntimeLoadedBeforeCall: boolean
  configRuntimeSourceLoaded: boolean
  configRuntimeDistLoaded: boolean
  eventsRootLoadedBeforeCall: boolean
  configRootLoadedAfterCall: boolean
  configRuntimeLoadedAfterCall: boolean
  eventsRootLoadedAfterCall: boolean
  port?: number
  portBeforeReady?: number
  sameConfig?: boolean
  sameDefaults?: boolean
  sameGetConfig?: boolean
}

interface ControllerProbeResult {
  controllerName: string
  frameworkModuleCount: number
  serverModuleCount: number
  serverRootLoaded: boolean
  baseSourceLoaded: boolean
  baseDistLoaded: boolean
}

const repositoryRoot = resolve(import.meta.dir, '../../../../..')
const config = join(repositoryRoot, 'bench/startup/bunfig.toml')
const fixture = join(import.meta.dir, 'fixtures/import-probe.ts')
const controllerFixture = join(import.meta.dir, 'fixtures/controller-import-probe.ts')

function runProbe(mode?: 'call-config' | 'await-config' | 'identity', options?: {
  cwd?: string
  skipConfigLoading?: boolean
}): ProbeResult {
  const child = Bun.spawnSync([
    process.execPath,
    '--no-env-file',
    `--config=${config}`,
    fixture,
    ...(mode ? [mode] : []),
  ], {
    cwd: options?.cwd ?? repositoryRoot,
    env: {
      ...process.env,
      LOG_WRITE_TO_FILE: 'false',
      SKIP_CONFIG_LOADING: options?.skipConfigLoading === false ? 'false' : 'true',
    },
  })

  expect(child.exitCode).toBe(0)
  const lines = child.stdout.toString().trim().split('\n')
  return JSON.parse(lines.at(-1)!) as ProbeResult
}

function runControllerProbe(): ControllerProbeResult {
  const child = Bun.spawnSync([
    process.execPath,
    '--no-env-file',
    `--config=${config}`,
    controllerFixture,
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
  return JSON.parse(lines.at(-1)!) as ControllerProbeResult
}

test('built-in controller import stays on the narrow server entry', () => {
  expect(runControllerProbe()).toEqual({
    controllerName: 'ComingSoonController',
    frameworkModuleCount: 3,
    serverModuleCount: 1,
    serverRootLoaded: false,
    baseSourceLoaded: true,
    baseDistLoaded: false,
  } satisfies ControllerProbeResult)
})

test('server import keeps broad runtime entries unloaded', () => {
  expect(runProbe()).toEqual({
    before: false,
    after: false,
    routerRootLoaded: false,
    routerRuntimeLoaded: false,
    configRootLoadedBeforeCall: false,
    configRuntimeLoadedBeforeCall: true,
    configRuntimeSourceLoaded: true,
    configRuntimeDistLoaded: false,
    eventsRootLoadedBeforeCall: false,
    configRootLoadedAfterCall: false,
    configRuntimeLoadedAfterCall: true,
    eventsRootLoadedAfterCall: false,
  } satisfies ProbeResult)
})

test('server configuration uses the narrow config runtime entry', () => {
  expect(runProbe('call-config')).toEqual({
    before: false,
    after: false,
    routerRootLoaded: false,
    routerRuntimeLoaded: false,
    configRootLoadedBeforeCall: false,
    configRuntimeLoadedBeforeCall: true,
    configRuntimeSourceLoaded: true,
    configRuntimeDistLoaded: false,
    eventsRootLoadedBeforeCall: false,
    configRootLoadedAfterCall: false,
    configRuntimeLoadedAfterCall: true,
    eventsRootLoadedAfterCall: false,
    port: 3008,
    portBeforeReady: 3008,
  } satisfies ProbeResult)
})

test('config root and runtime entries share one source instance', () => {
  const result = runProbe('identity')

  expect(result.configRuntimeSourceLoaded).toBe(true)
  expect(result.configRuntimeDistLoaded).toBe(false)
  expect(result.sameConfig).toBe(true)
  expect(result.sameDefaults).toBe(true)
  expect(result.sameGetConfig).toBe(true)
})

test('server configuration observes port overrides after config is ready', () => {
  const project = mkdtempSync(join(tmpdir(), 'stacks-server-config-'))

  try {
    mkdirSync(join(project, 'config'))
    writeFileSync(join(project, 'config/ports.ts'), 'export default { api: 43123 }\n')

    const result = runProbe('await-config', {
      cwd: project,
      skipConfigLoading: false,
    })

    expect(result.configRootLoadedBeforeCall).toBe(false)
    expect(result.configRuntimeLoadedBeforeCall).toBe(true)
    expect(result.configRuntimeSourceLoaded).toBe(true)
    expect(result.configRuntimeDistLoaded).toBe(false)
    expect(result.eventsRootLoadedBeforeCall).toBe(false)
    expect(result.configRootLoadedAfterCall).toBe(false)
    expect(result.configRuntimeLoadedAfterCall).toBe(true)
    expect(result.eventsRootLoadedAfterCall).toBe(false)
    expect(result.port).toBe(43123)
  }
  finally {
    rmSync(project, { recursive: true, force: true })
  }
})
