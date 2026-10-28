import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { applyWithheldEnv, WITHHELD_ENV, withheldEnvKeys, withholdEnv } from '../src/withheld'

// stacksjs/stacks#3028: `buddy release:ios` deleted MOBILE_URL from its own
// environment and spawned the build, which read it straight back out of .env
// and shipped `http://localhost:3010/m` as the release's dev server.

describe('withholding keys from a child process', () => {
  it('names the keys, merging with what this process was itself told to withhold', () => {
    expect(withheldEnvKeys({ [WITHHELD_ENV]: ' MOBILE_URL, IOS_BUILD_NUMBER ,,' })).toEqual(new Set(['MOBILE_URL', 'IOS_BUILD_NUMBER']))
    expect(withheldEnvKeys({})).toEqual(new Set())
    const previous = process.env[WITHHELD_ENV]
    process.env[WITHHELD_ENV] = 'CRAFT_IOS_SRC'
    try {
      expect(withholdEnv(['MOBILE_URL'])).toEqual({ [WITHHELD_ENV]: 'CRAFT_IOS_SRC,MOBILE_URL' })
    }
    finally {
      if (previous === undefined)
        delete process.env[WITHHELD_ENV]
      else
        process.env[WITHHELD_ENV] = previous
    }
  })

  it('removes withheld keys and nothing else', () => {
    const env: Record<string, string | undefined> = { [WITHHELD_ENV]: 'MOBILE_URL,ABSENT', MOBILE_URL: 'http://localhost:3010/m', APP_URL: 'https://example.test' }
    expect(applyWithheldEnv(env)).toEqual(['MOBILE_URL'])
    expect(env).toEqual({ [WITHHELD_ENV]: 'MOBILE_URL,ABSENT', APP_URL: 'https://example.test' })
  })
})

describe('a child that loads .env', () => {
  let app: string

  beforeEach(() => {
    app = mkdtempSync(join(tmpdir(), 'stacks-withheld-env-'))
    writeFileSync(join(app, '.env'), 'MOBILE_URL=http://localhost:3010/m\nAPP_URL=https://example.test\n')
    writeFileSync(join(app, 'bunfig.toml'), `preload = [${JSON.stringify(join(import.meta.dir, '..', 'plugin.ts'))}]\n`)
    writeFileSync(join(app, 'print.ts'), 'console.log(JSON.stringify({ MOBILE_URL: process.env.MOBILE_URL ?? null, APP_URL: process.env.APP_URL ?? null }))\n')
  })
  afterEach(() => rmSync(app, { recursive: true, force: true }))

  // The parent's side, as release:ios does it: the key deleted from its own
  // environment, everything else passed through.
  function child(flags: string[], extra: Record<string, string> = {}): { MOBILE_URL: string | null, APP_URL: string | null } {
    const env: Record<string, string | undefined> = { ...process.env, ...extra }
    delete env.MOBILE_URL
    delete env.APP_URL
    const run = Bun.spawnSync([process.execPath, ...flags, 'print.ts'], { cwd: app, env })
    return JSON.parse(run.stdout.toString().trim().split('\n').at(-1)!)
  }

  for (const flags of [[], ['--no-env-file']]) {
    const loader = flags.length ? 'the Stacks env loader alone' : 'Bun\'s native .env load and the Stacks env loader'
    it(`reads a deleted key back from .env through ${loader}, which is the bug`, () => {
      expect(child(flags)).toEqual({ MOBILE_URL: 'http://localhost:3010/m', APP_URL: 'https://example.test' })
    })

    it(`keeps a withheld key out through ${loader}, and loads the rest`, () => {
      expect(child(flags, withholdEnv(['MOBILE_URL']))).toEqual({ MOBILE_URL: null, APP_URL: 'https://example.test' })
    })
  }
})
