import { afterEach, describe, expect, test } from 'bun:test'
import process from 'node:process'
import { isLocalDeployment, isLoopbackHost } from '../src/deployment'

/**
 * `.env.example` ships `APP_ENV=development`, so an environment NAME cannot
 * decide whether a deployment is local: every app that never edited that line
 * calls itself development in production. The same shape made auth cookies
 * drop `Secure` in stacksjs/stacks#2275, and it left the dashboard API's
 * `guard()` attaching no middleware at all.
 */
const original = { APP_URL: process.env.APP_URL, APP_ENV: process.env.APP_ENV, NODE_ENV: process.env.NODE_ENV }

function withEnv(values: { APP_URL?: string, APP_ENV?: string, NODE_ENV?: string }): boolean {
  for (const key of ['APP_URL', 'APP_ENV', 'NODE_ENV'] as const) {
    if (values[key] === undefined)
      delete process.env[key]
    else
      process.env[key] = values[key]
  }
  return isLocalDeployment()
}

afterEach(() => {
  for (const [key, value] of Object.entries(original)) {
    if (value === undefined)
      delete process.env[key]
    else
      process.env[key] = value
  }
})

describe('isLoopbackHost', () => {
  test('accepts the hosts a developer actually serves from', () => {
    for (const host of ['localhost', 'stacks.localhost', '127.0.0.1', '0.0.0.0', '::1', '[::1]', 'LOCALHOST'])
      expect(isLoopbackHost(host), host).toBe(true)
  })

  test('rejects public hosts, including ones that merely contain the word', () => {
    for (const host of ['example.com', 'app.example.com', 'localhost.evil.com', 'notlocalhost'])
      expect(isLoopbackHost(host), host).toBe(false)
  })
})

describe('isLocalDeployment', () => {
  test('the URL decides when one is configured', () => {
    expect(withEnv({ APP_URL: 'https://app.example.com', APP_ENV: 'development' })).toBe(false)
    expect(withEnv({ APP_URL: 'https://stacks.localhost', APP_ENV: '' })).toBe(true)
  })

  test('an explicit deployment name outranks a loopback URL', () => {
    // Otherwise a production build run against the repo's own
    // `APP_URL=stacks.localhost` would re-open stacksjs/stacks#1955.
    for (const name of ['production', 'prod', 'staging'])
      expect(withEnv({ APP_URL: 'stacks.localhost', APP_ENV: name }), name).toBe(false)
  })

  test('a scheme-less URL is still read for its host', () => {
    // What `buddy dev` writes into .env.
    expect(withEnv({ APP_URL: 'stacks.localhost', APP_ENV: 'development' })).toBe(true)
    expect(withEnv({ APP_URL: 'app.example.com', APP_ENV: 'development' })).toBe(false)
  })

  test('the shipped .env.example shape is not local on a public host', () => {
    // The whole point: APP_ENV=development is what every unedited app says.
    expect(withEnv({ APP_URL: 'https://api.acme.io', APP_ENV: 'development' })).toBe(false)
  })

  test('with no URL, only unambiguous names opt out', () => {
    for (const name of ['', 'local', 'dev', 'test', 'testing'])
      expect(withEnv({ APP_ENV: name }), name || '(unset)').toBe(true)
    for (const name of ['development', 'production', 'staging', 'prod'])
      expect(withEnv({ APP_ENV: name }), name).toBe(false)
  })

  test('NODE_ENV is the fallback, and APP_ENV wins', () => {
    expect(withEnv({ NODE_ENV: 'test' })).toBe(true)
    expect(withEnv({ NODE_ENV: 'production' })).toBe(false)
    expect(withEnv({ APP_ENV: 'local', NODE_ENV: 'production' })).toBe(true)
  })

  test('an unparseable URL falls back to the name rather than guessing', () => {
    expect(withEnv({ APP_URL: 'http://', APP_ENV: 'local' })).toBe(true)
    expect(withEnv({ APP_URL: 'http://', APP_ENV: 'development' })).toBe(false)
  })
})
