import { expect, test } from 'bun:test'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { deploymentRetirements, explicitDeploymentEnvFile, validateDeploymentProviderInputs } from '../src/deployment-inputs'

test('an explicit runtime file cannot silently use another environment', () => {
  const root = mkdtempSync(join(tmpdir(), 'deployment-env-'))
  try {
    writeFileSync(join(root, '.env.production'), 'SIGNING_SECRET=private\n')
    expect(explicitDeploymentEnvFile(root)).toBeUndefined()
    expect(() => explicitDeploymentEnvFile(root, '.env.web')).toThrow('does not exist')
    writeFileSync(join(root, '.env.web'), 'APP_KEY=web-only\n')
    expect(explicitDeploymentEnvFile(root, '.env.web')).toBe(join(root, '.env.web'))
  }
  finally { rmSync(root, { recursive: true, force: true }) }
})

test('operator retirement is explicit, does not mutate config, and cannot retire a declared site', () => {
  const config = { cloud: { provider: 'hetzner', retiredDomains: ['earlier.example'] }, sites: { main: { domain: 'host.example' } } }
  const next = deploymentRetirements(config, 'old.example,OLD.example')
  expect(next.cloud.retiredDomains).toEqual(['earlier.example', 'old.example'])
  expect(config.cloud.retiredDomains).toEqual(['earlier.example'])
  expect(() => deploymentRetirements(config, 'host.example')).toThrow('still declared')
  for (const invalid of ['', 'https://old.example', 'old.example;echo', 'old..example'])
    expect(() => deploymentRetirements(config, invalid)).toThrow('hostnames')
})

test('an encrypted web runtime uses its own key and excludes signing and process secrets', async () => {
  const { generateKeypair, encryptValue } = await import('@stacksjs/env/crypto')
  const { resolveDeployEnvValues } = await import('../src/commands/deploy')
  const root = mkdtempSync(join(tmpdir(), 'deployment-isolation-'))
  const pair = generateKeypair()
  const previousKey = process.env.DOTENV_PRIVATE_KEY_WEB
  const previousSecret = process.env.SIGNING_SECRET
  try {
    writeFileSync(join(root, '.env.production'), 'SIGNING_SECRET=desktop-signing-only\n')
    writeFileSync(join(root, '.env.web'), `DOTENV_PUBLIC_KEY_WEB=${pair.publicKey}\nAPP_KEY=${JSON.stringify(encryptValue('web-runtime-only', pair.publicKey))}\n`)
    process.env.DOTENV_PRIVATE_KEY_WEB = pair.privateKey
    process.env.SIGNING_SECRET = 'process-signing-only'
    const file = explicitDeploymentEnvFile(root, '.env.web')
    expect(await resolveDeployEnvValues('production', { project: { slug: 'example' } }, file)).toEqual({ APP_KEY: 'web-runtime-only' })
  }
  finally {
    if (previousKey === undefined) delete process.env.DOTENV_PRIVATE_KEY_WEB
    else process.env.DOTENV_PRIVATE_KEY_WEB = previousKey
    if (previousSecret === undefined) delete process.env.SIGNING_SECRET
    else process.env.SIGNING_SECRET = previousSecret
    rmSync(root, { recursive: true, force: true })
  }
})

test('provider paths cannot silently ignore runtime-file or gateway-retirement inputs', () => {
  for (const provider of ['ssh', 'hetzner', 'fly'])
    expect(() => validateDeploymentProviderInputs(provider, { envFile: '.env.web' })).not.toThrow()
  expect(() => validateDeploymentProviderInputs('aws', { envFile: '.env.web' })).toThrow('requires')
  expect(() => validateDeploymentProviderInputs('fly', { retireDomains: 'old.example' })).toThrow('gateway')
  expect(() => validateDeploymentProviderInputs('aws', {})).not.toThrow()
})
