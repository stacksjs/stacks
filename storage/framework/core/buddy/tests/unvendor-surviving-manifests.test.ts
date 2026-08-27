import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'bun:test'
import { rewriteSurvivingFrameworkManifests } from '../src/unvendor-rewrite'

const roots: string[] = []

afterEach(() => {
  for (const root of roots.splice(0))
    rmSync(root, { recursive: true, force: true })
})

describe('unvendor surviving framework manifests', () => {
  it('repoints workspace ranges outside core and leaves unrelated ranges alone', async () => {
    const root = mkdtempSync(join(tmpdir(), 'stacks-unvendor-manifests-'))
    roots.push(root)

    const server = join(root, 'storage/framework/server')
    const core = join(root, 'storage/framework/core/server')
    mkdirSync(server, { recursive: true })
    mkdirSync(core, { recursive: true })
    writeFileSync(join(server, 'package.json'), JSON.stringify({
      dependencies: {
        '@stacksjs/router': 'workspace:*',
        'external': '^1.2.3',
      },
      devDependencies: { '@stacksjs/path': 'workspace:^' },
    }))
    writeFileSync(join(core, 'package.json'), JSON.stringify({
      dependencies: { '@stacksjs/router': 'workspace:*' },
    }))

    const result = await rewriteSurvivingFrameworkManifests(
      root,
      new Set(['@stacksjs/router', '@stacksjs/path']),
      '^0.72.86',
    )

    const manifest = JSON.parse(readFileSync(join(server, 'package.json'), 'utf8'))
    expect(manifest.dependencies['@stacksjs/router']).toBe('^0.72.86')
    expect(manifest.devDependencies['@stacksjs/path']).toBe('^0.72.86')
    expect(manifest.dependencies.external).toBe('^1.2.3')
    expect(result).toEqual({ files: ['storage/framework/server/package.json'], ranges: 2 })

    const coreManifest = JSON.parse(readFileSync(join(core, 'package.json'), 'utf8'))
    expect(coreManifest.dependencies['@stacksjs/router']).toBe('workspace:*')
  })
})
