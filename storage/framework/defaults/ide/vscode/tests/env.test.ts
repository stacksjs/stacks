/**
 * Env file support (src/env.ts, src/env-file.ts). Values are encrypted with
 * `@stacksjs/env`'s own `encryptValue`, so the round trip is the real one.
 */
import { describe, expect, it } from 'bun:test'
import { encryptValue, generateKeypair } from '../../../../core/env/src/crypto'
import { createEnvSupport, projectDecryptor } from '../src/env'
import { decryptEnvValue, envEntryAt, findPrivateKey, isEnvFile, missingKeys } from '../src/env-file'
import { loadProjectEnv } from '../src/project'
import { document, fakeVscode, flush, Position } from './fake-vscode'

const ROOT = '/work/app'
const { publicKey, privateKey } = generateKeypair()
const other = generateKeypair()
const SECRET = 's3cret value with spaces'
const ENCRYPTED = encryptValue(SECRET, publicKey)

describe('env files', () => {
  it('knows env files from the private key file', () => {
    expect(['.env', '.env.local', '.env.production', '.env.example'].every(name => isEnvFile(`${ROOT}/${name}`))).toBeTrue()
    expect(isEnvFile(`${ROOT}/.env.keys`)).toBeFalse()
    expect(isEnvFile(`${ROOT}/env.ts`)).toBeFalse()
  })

  it('finds the value on a line, quotes excluded', () => {
    expect(envEntryAt('export API_KEY="abc"')).toEqual({ key: 'API_KEY', value: 'abc', start: 16, end: 19 })
    expect(envEntryAt('PORT=3000 # dev')).toEqual({ key: 'PORT', value: '3000', start: 5, end: 9 })
    expect(envEntryAt('# just a comment')).toBeUndefined()
  })

  it('lists the keys .env.example has and .env does not', () => {
    expect(missingKeys('APP_NAME=\nAPP_KEY=\n# note\nDB_HOST=', 'APP_NAME=Stacks\nexport DB_HOST=x')).toEqual(['APP_KEY'])
  })
})

describe('private keys', () => {
  it('looks them up the way ./buddy env:get does: the file\'s key, then the plain one, .env.keys before the environment', () => {
    const keys = 'DOTENV_PRIVATE_KEY=plain\nDOTENV_PRIVATE_KEY_PRODUCTION=prod'
    expect(findPrivateKey(`${ROOT}/.env.production`, keys, {})).toEqual({ name: 'DOTENV_PRIVATE_KEY_PRODUCTION', key: 'prod', from: '.env.keys' })
    expect(findPrivateKey(`${ROOT}/.env.staging`, keys, {})).toEqual({ name: 'DOTENV_PRIVATE_KEY', key: 'plain', from: '.env.keys' })
    expect(findPrivateKey(`${ROOT}/.env.production`, undefined, { DOTENV_PRIVATE_KEY_PRODUCTION: 'ci' })).toEqual({ name: 'DOTENV_PRIVATE_KEY_PRODUCTION', key: 'ci', from: 'environment' })
    expect(findPrivateKey(`${ROOT}/.env`, undefined, {})).toBeUndefined()
  })

  it('decrypts with @stacksjs/env, and says why when it cannot', () => {
    expect(decryptEnvValue(`${ROOT}/.env`, ENCRYPTED, `DOTENV_PRIVATE_KEY=${privateKey}`, {})).toMatchObject({ ok: true, value: SECRET })
    expect(decryptEnvValue(`${ROOT}/.env`, ENCRYPTED, undefined, {})).toEqual({ ok: false, reason: 'no-key', looked: ['DOTENV_PRIVATE_KEY'] })
    expect(decryptEnvValue(`${ROOT}/.env`, ENCRYPTED, `DOTENV_PRIVATE_KEY=${other.privateKey}`, {})).toMatchObject({ ok: false, reason: 'failed' })
  })

  it('lets the preview read an encrypted APP_URL, and still skips one it cannot decrypt', () => {
    const files: Record<string, string> = {
      [`${ROOT}/.env`]: `APP_URL=${ENCRYPTED}\nPORT=${encryptValue('3100', other.publicKey)}`,
      [`${ROOT}/.env.keys`]: `DOTENV_PRIVATE_KEY=${privateKey}`,
    }
    const host = { exists: (path: string) => path in files, read: (path: string) => files[path], exec: async () => '', environment: {} }
    const env = loadProjectEnv(file => files[`${ROOT}/${file}`], ['.env'], projectDecryptor(host, ROOT))
    expect(env).toEqual({ APP_URL: SECRET })
  })
})

function setup(files: Record<string, string>, settings: Record<string, unknown> = {}) {
  const host = {
    exists: (path: string) => path in files,
    read: (path: string) => files[path],
    execs: [] as string[][],
    async exec(file: string, args: string[], cwd: string) {
      host.execs.push([file, ...args, `(in ${cwd})`])
      return 'the value\n'
    },
    environment: {},
  }
  const fake = fakeVscode({ folders: [ROOT], settings })
  const support = createEnvSupport(fake.api as any, host)
  support.activate(fake.context)
  return { ...fake, host }
}

describe('hover', () => {
  const line = `API_KEY="${ENCRYPTED}"`
  const files = { [`${ROOT}/buddy`]: '', [`${ROOT}/.env.keys`]: `DOTENV_PRIVATE_KEY=${privateKey}` }

  it('shows an encrypted value decrypted, and names the key it used', () => {
    const { hovers } = setup(files)
    const hover = hovers[0].provideHover(document(`${ROOT}/.env`, line, 'dotenv'), new Position(0, 20))

    expect(hover.contents.value).toContain(SECRET)
    expect(hover.contents.value).toContain('`DOTENV_PRIVATE_KEY` from `.env.keys`')
    expect(hover.range.start.character).toBe(9)
  })

  it('explains a value it has no key for', () => {
    const { hovers } = setup({ [`${ROOT}/buddy`]: '' })
    const hover = hovers[0].provideHover(document(`${ROOT}/.env`, line, 'dotenv'), new Position(0, 20))
    expect(hover.contents.value).toContain('No private key')
    expect(hover.contents.value).not.toContain(SECRET)
  })

  it('stays quiet on plaintext, on the key name, in other files and when turned off', () => {
    expect(setup(files).hovers[0].provideHover(document(`${ROOT}/.env`, 'PORT=3000', 'dotenv'), new Position(0, 6))).toBeUndefined()
    expect(setup(files).hovers[0].provideHover(document(`${ROOT}/.env`, line, 'dotenv'), new Position(0, 2))).toBeUndefined()
    expect(setup(files).hovers[0].provideHover(document(`${ROOT}/app/x.ts`, line), new Position(0, 20))).toBeUndefined()
    expect(setup(files, { 'env.decryptOnHover': false }).hovers[0].provideHover(document(`${ROOT}/.env`, line, 'dotenv'), new Position(0, 20))).toBeUndefined()
  })
})

describe('missing keys', () => {
  it('flags keys .env.example declares that .env does not set', async () => {
    const { diagnostics, events } = setup({ [`${ROOT}/.env.example`]: 'APP_NAME=\nAPP_KEY=\n' })
    events.opened.fire(document(`${ROOT}/.env`, 'APP_NAME=Stacks\n', 'dotenv') as any)
    await flush()

    const list = diagnostics.get(`file://${ROOT}/.env`)!
    expect(list.map((diagnostic: any) => diagnostic.message)).toEqual(['APP_KEY is in .env.example but not set here.'])
    expect(list[0].severity).toBe(2)
  })

  it('does not compare other env files, which legitimately differ', async () => {
    const { diagnostics, events } = setup({ [`${ROOT}/.env.example`]: 'APP_KEY=\n' })
    events.opened.fire(document(`${ROOT}/.env.production`, '', 'dotenv') as any)
    await flush()
    expect(diagnostics.get(`file://${ROOT}/.env.production`)).toBeUndefined()
  })
})

describe('buddy env commands', () => {
  const files = { [`${ROOT}/buddy`]: '', [`${ROOT}/.env`]: 'APP_NAME=Stacks\nAPI_KEY=x\n' }

  it('sets a value through ./buddy env:set, without a shell, from a password box', async () => {
    const fake = setup(files)
    fake.answers.push('API_KEY', 'hunter2')
    await fake.handlers.get('stacks.env.set')!()

    expect(fake.host.execs).toEqual([[`${ROOT}/buddy`, 'env:set', 'API_KEY', 'hunter2', '--file', '.env', `(in ${ROOT})`]])
    expect(fake.inputs[1].password).toBeTrue()
  })

  it('gets a value through ./buddy env:get and copies it only when asked', async () => {
    const fake = setup(files)
    fake.answers.push('API_KEY', 'Copy Value')
    await fake.handlers.get('stacks.env.get')!()

    expect(fake.host.execs[0]!.slice(1, 5)).toEqual(['env:get', 'API_KEY', '--file', '.env'])
    expect(fake.messages[0]).not.toContain('the value')
    expect(fake.clipboard).toEqual(['the value'])
  })

  it('asks before writing plaintext to disk', async () => {
    const fake = setup(files)
    fake.answers.push(undefined)
    await fake.handlers.get('stacks.env.decrypt')!()
    expect(fake.host.execs).toEqual([])
    expect(fake.messages[0]).toContain('plaintext')

    fake.answers.push('Continue', undefined)
    await fake.handlers.get('stacks.env.decrypt')!()
    expect(fake.host.execs[0]!.slice(1, 4)).toEqual(['env:decrypt', '--file', '.env'])
  })

  it('acts on the env file that is open', async () => {
    const fake = setup({ ...files, [`${ROOT}/.env.production`]: 'APP_KEY=x\n' })
    fake.api.window.activeTextEditor = { document: document(`${ROOT}/.env.production`, '', 'dotenv') }
    await fake.handlers.get('stacks.env.encrypt')!()
    expect(fake.host.execs[0]!.slice(1, 4)).toEqual(['env:encrypt', '--file', '.env.production'])
  })
})
