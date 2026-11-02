import { expect, test } from 'bun:test'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { runIsolated } from '@stacksjs/testing/isolated'

// Exercise the public facade against real native config loading in a fresh
// application process. Distributed-package resolution is checked after build.
async function consumer(configSource: string | undefined, operation = 'await init()', appSource?: string): Promise<{ code: number | null, stdout: string, stderr: string }> {
  const directory = await mkdtemp(join(tmpdir(), 'stacks-sms-config-'))
  try {
    // Use the framework's maintained workspace identities, without inheriting
    // application preloads or relying on another checkout's installed builds.
    await writeFile(join(directory, 'tsconfig.json'), JSON.stringify({ extends: join(import.meta.dir, '../../tsconfig.build.json') }))
    if (configSource !== undefined || appSource !== undefined)
      await mkdir(join(directory, 'config'))
    if (configSource !== undefined)
      await writeFile(join(directory, 'config/sms.ts'), configSource)
    if (appSource !== undefined)
      await writeFile(join(directory, 'config/app.ts'), appSource)
    const moduleUrl = pathToFileURL(join(import.meta.dir, '../src/sms.ts')).href
    await writeFile(join(directory, 'probe.ts'), `
      import { init, getConfig, isEnabled, configure, formatE164 } from ${JSON.stringify(moduleUrl)}
      ${operation}
      const config = getConfig()
      console.log(JSON.stringify({ enabled: isEnabled(), provider: config.provider, from: config.from, countryCode: config.defaultCountryCode, templates: config.templates, formatted: formatE164('123456789') }))
    `)
    return await runIsolated(join(directory, 'probe.ts'), {
      cwd: directory,
      inheritEnv: false,
      env: { PATH: process.env.PATH, APP_ENV: 'test', NODE_ENV: 'test', SKIP_CONFIG_LOADING: 'false', SKIP_CONFIG_VALIDATION: 'false' },
      envFile: false,
      preload: [],
      timeoutMs: 10_000,
    })
  }
  finally {
    await rm(directory, { recursive: true, force: true })
  }
}

test('init reads application SMS settings through the native configuration system', async () => {
  const result = await consumer(`export default { enabled: true, provider: 'vonage', from: 'SMS-CONFIG-SENTINEL', defaultCountryCode: '49', templates: [{ name: 'fixture', body: 'local only' }] }`)
  expect(result.code, result.stderr).toBe(0)
  expect(JSON.parse(result.stdout)).toEqual({ enabled: true, provider: 'vonage', from: 'SMS-CONFIG-SENTINEL', countryCode: '49', templates: [{ name: 'fixture', body: 'local only' }], formatted: '+49123456789' })
})

test('init waits for asynchronous application configuration before reading settings', async () => {
  const result = await consumer(`await Bun.sleep(30); export default { enabled: true, provider: 'vonage', from: 'ASYNC-CONFIG', defaultCountryCode: '44' }`)
  expect(result.code, result.stderr).toBe(0)
  expect(JSON.parse(result.stdout)).toEqual({ enabled: true, provider: 'vonage', from: 'ASYNC-CONFIG', countryCode: '44', formatted: '+44123456789' })
})

test('an application without an SMS file receives native disabled defaults', async () => {
  const result = await consumer(undefined)
  expect(result.code, result.stderr).toBe(0)
  expect(JSON.parse(result.stdout)).toEqual({ enabled: false, provider: 'twilio', formatted: '+1123456789' })
})

test('explicit configuration supplied before and during loading survives repeated init', async () => {
  const result = await consumer(`await Bun.sleep(30); export default { enabled: true, provider: 'vonage', from: 'FILE-SENDER', defaultCountryCode: '49' }`, `
    configure({ enabled: false })
    const loading = init()
    configure({ from: 'EXPLICIT-SENDER' })
    await loading
    await init()
  `)
  expect(result.code, result.stderr).toBe(0)
  expect(JSON.parse(result.stdout)).toEqual({ enabled: false, provider: 'vonage', from: 'EXPLICIT-SENDER', countryCode: '49', formatted: '+49123456789' })
})

test('init propagates native configuration validation failure instead of silently using defaults', async () => {
  const result = await consumer(undefined, 'await init()', `export default { env: 'invalid-application-environment' }`)
  expect(result.code).not.toBe(0)
  expect(result.stderr).toContain('configuration issue(s) detected at boot')
  expect(result.stderr).toContain('app.env: expected one of')
  expect(result.stdout).toBe('')
})
