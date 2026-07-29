import { afterEach, describe, expect, it } from 'bun:test'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { loadModelRegistry, modelFiles } from '../src/model-registry'

const testRoot = join(import.meta.dir, '.tmp-model-registry')

function writeModel(root: string, relativePath: string, name: string, marker: string): void {
  const file = join(root, relativePath)
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, `export default { name: '${name}', marker: '${marker}' }\n`)
}

afterEach(() => {
  rmSync(testRoot, { recursive: true, force: true })
})

describe('ORM model registry', () => {
  it('discovers nested framework models', () => {
    const defaultsRoot = join(testRoot, 'defaults')
    writeModel(defaultsRoot, 'commerce/Product.ts', 'Product', 'framework')
    writeModel(defaultsRoot, 'MailPreference.ts', 'MailPreference', 'framework')

    expect(modelFiles(defaultsRoot).map(file => file.slice(defaultsRoot.length + 1))).toEqual([
      'MailPreference.ts',
      'commerce/Product.ts',
    ])
  })

  it('loads framework defaults when app/Models is absent', async () => {
    const defaultsRoot = join(testRoot, 'defaults')
    writeModel(defaultsRoot, 'MailPreference.ts', 'MailPreference', 'framework')

    const registry = await loadModelRegistry({
      defaultsRoot,
      userRoot: join(testRoot, 'missing-user'),
    })

    expect(registry.MailPreference?.marker).toBe('framework')
  })

  it('lets userland models override framework defaults by model name', async () => {
    const defaultsRoot = join(testRoot, 'defaults')
    const userRoot = join(testRoot, 'user')
    writeModel(defaultsRoot, 'User.ts', 'User', 'framework')
    writeModel(userRoot, 'Account.ts', 'User', 'user')

    const registry = await loadModelRegistry({ defaultsRoot, userRoot })

    expect(registry.User?.marker).toBe('user')
  })
})
