import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { activeEnvName, autoLoadEnv, resetPrivateKeyCache } from '../src/plugin'

/**
 * Which environment the env layer thinks it is running as decides which
 * private key it looks for, and therefore whether an encrypted file can be
 * read at all.
 *
 * The file loader and the key lookup used to read the same three variables in
 * different orders. An app whose `.env` sets `APP_ENV=development` and whose
 * server runs under `NODE_ENV=production` loaded `.env.production` and then
 * asked for the development key: every encrypted value in the file it had
 * just read fell back to its default, with one warning that pointed at a key
 * that was present and correct all along.
 */
const SAVED = {
  NODE_ENV: process.env.NODE_ENV,
  APP_ENV: process.env.APP_ENV,
  DOTENV_ENV: process.env.DOTENV_ENV,
}

beforeEach(() => {
  delete process.env.NODE_ENV
  delete process.env.APP_ENV
  delete process.env.DOTENV_ENV

  /*
   * `loadedEnvName` is module state that outranks all three variables above, so
   * clearing the environment is not enough to control what `activeEnvName`
   * answers. Under `bun test` the preload has already recorded `test`, which is
   * why this file failed even when run on its own: it was asserting on an input
   * it did not set. Same reset the env proxy's own tests use (#2259).
   */
  resetPrivateKeyCache()
})

afterEach(() => {
  // Leave no recorded environment behind either: the next file in the process
  // should see the same starting state this one did.
  resetPrivateKeyCache()

  for (const [key, value] of Object.entries(SAVED)) {
    if (value === undefined)
      delete process.env[key]
    else
      process.env[key] = value
  }
})

describe('activeEnvName', () => {
  it('prefers an explicit argument', () => {
    process.env.NODE_ENV = 'production'

    expect(activeEnvName({ env: 'staging' })).toBe('staging')
  })

  it('reads NODE_ENV ahead of APP_ENV, matching the file loader', () => {
    process.env.NODE_ENV = 'production'
    process.env.APP_ENV = 'development'

    expect(activeEnvName()).toBe('production')
  })

  it('normalises the short forms', () => {
    process.env.NODE_ENV = 'prod'
    expect(activeEnvName()).toBe('production')

    process.env.NODE_ENV = 'stage'
    expect(activeEnvName()).toBe('staging')
  })

  it('defaults to development', () => {
    expect(activeEnvName()).toBe('development')
  })

  it('follows the environment whose file was loaded', () => {
    // `.env` sets APP_ENV=development in most apps; the loader still loaded
    // the production file, so the production key is the one to look for.
    process.env.NODE_ENV = 'production'
    autoLoadEnv({ cwd: '/nonexistent-so-nothing-is-read' })
    process.env.APP_ENV = 'development'
    delete process.env.NODE_ENV

    expect(activeEnvName()).toBe('production')
  })
})
