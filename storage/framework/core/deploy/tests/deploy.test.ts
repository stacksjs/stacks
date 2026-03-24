import { describe, expect, test } from 'bun:test'
import { existsSync } from 'node:fs'
import { join } from 'node:path'

const basePath = join(import.meta.dir, '..')

describe('deploy module structure', () => {
  test('package.json exists', () => {
    expect(existsSync(join(basePath, 'package.json'))).toBe(true)
  })

  test('index.ts entry point exists', () => {
    expect(existsSync(join(basePath, 'index.ts'))).toBe(true)
  })

  test('deploy.ts source file exists', () => {
    expect(existsSync(join(basePath, 'deploy.ts'))).toBe(true)
  })

  test('stack.ts source file exists', () => {
    expect(existsSync(join(basePath, 'stack.ts'))).toBe(true)
  })

  test('dev.ts source file exists', () => {
    expect(existsSync(join(basePath, 'dev.ts'))).toBe(true)
  })
})

describe('deploy module exports', () => {
  test('deployFrontend is exported', async () => {
    const mod = await import('../index')
    expect(typeof mod.deployFrontend).toBe('function')
  })

  test('buildFrontend is exported', async () => {
    const mod = await import('../index')
    expect(typeof mod.buildFrontend).toBe('function')
  })

  test('buildAndDeploy is exported', async () => {
    const mod = await import('../index')
    expect(typeof mod.buildAndDeploy).toBe('function')
  })

  test('deployStack is exported', async () => {
    const mod = await import('../index')
    expect(typeof mod.deployStack).toBe('function')
  })

  test('deleteStack is exported', async () => {
    const mod = await import('../index')
    expect(typeof mod.deleteStack).toBe('function')
  })

  test('getStackInfo is exported', async () => {
    const mod = await import('../index')
    expect(typeof mod.getStackInfo).toBe('function')
  })

  test('startDevServer is exported', async () => {
    const mod = await import('../index')
    expect(typeof mod.startDevServer).toBe('function')
  })

  test('startWithDeploy is exported', async () => {
    const mod = await import('../index')
    expect(typeof mod.startWithDeploy).toBe('function')
  })
})

describe('deploy package.json', () => {
  test('package name is @stacksjs/deploy', async () => {
    const pkg = await Bun.file(join(basePath, 'package.json')).json()
    expect(pkg.name).toBe('@stacksjs/deploy')
  })

  test('package is private', async () => {
    const pkg = await Bun.file(join(basePath, 'package.json')).json()
    expect(pkg.private).toBe(true)
  })

  test('package depends on ts-cloud', async () => {
    const pkg = await Bun.file(join(basePath, 'package.json')).json()
    expect(pkg.dependencies).toHaveProperty('@stacksjs/ts-cloud')
  })
})
