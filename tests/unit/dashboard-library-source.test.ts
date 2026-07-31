import { afterEach, describe, expect, it } from 'bun:test'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  componentSourceRows,
  functionSourceRows,
  workspacePackageRows,
} from '../../storage/framework/defaults/app/Actions/Dashboard/Library/library-source'

describe('dashboard Library source discovery', () => {
  let projectRoot = ''

  afterEach(() => {
    if (projectRoot)
      rmSync(projectRoot, { force: true, recursive: true })
  })

  it('reads functions and components from app source directories', () => {
    projectRoot = mkdtempSync(join(tmpdir(), 'stacks-library-source-'))
    mkdirSync(join(projectRoot, 'resources', 'functions'), { recursive: true })
    mkdirSync(join(projectRoot, 'resources', 'components', 'Account'), { recursive: true })
    writeFileSync(join(projectRoot, 'resources', 'functions', 'send-email.ts'), 'export function sendEmail() {}')
    writeFileSync(join(projectRoot, 'resources', 'components', 'Account', 'ProfileCard.stx'), '<div>Profile</div>')

    expect(functionSourceRows(projectRoot)).toMatchObject([
      { name: 'send-email', path: 'resources/functions/send-email.ts', extension: 'ts' },
    ])
    expect(componentSourceRows(projectRoot)).toMatchObject([
      { name: 'Account/ProfileCard', path: 'resources/components/Account/ProfileCard.stx', category: 'Account' },
    ])
  })

  it('reads package metadata from bun.lock workspaces', () => {
    projectRoot = mkdtempSync(join(tmpdir(), 'stacks-library-packages-'))
    mkdirSync(join(projectRoot, 'packages', 'example'), { recursive: true })
    writeFileSync(join(projectRoot, 'bun.lock'), `{
      "lockfileVersion": 1,
      "workspaces": {
        "packages/example": {
          "name": "@example/package"
        }
      }
    }`)
    writeFileSync(join(projectRoot, 'packages', 'example', 'package.json'), JSON.stringify({
      name: '@example/package',
      version: '1.2.3',
      description: 'Example workspace',
      license: 'MIT',
      dependencies: { one: '^1.0.0' },
      peerDependencies: { two: '^2.0.0' },
    }))

    expect(workspacePackageRows(projectRoot)).toEqual([
      {
        name: '@example/package',
        version: '1.2.3',
        description: 'Example workspace',
        license: 'MIT',
        private: false,
        path: 'packages/example',
        url: '',
        dependencyCount: 2,
      },
    ])
  })

  it('reports a missing lockfile instead of presenting an empty package list', () => {
    projectRoot = mkdtempSync(join(tmpdir(), 'stacks-library-missing-lock-'))

    expect(() => workspacePackageRows(projectRoot)).toThrow(
      'Could not read dashboard library source bun.lock: file does not exist',
    )
  })

  it('reports a missing workspace manifest', () => {
    projectRoot = mkdtempSync(join(tmpdir(), 'stacks-library-missing-manifest-'))
    writeFileSync(join(projectRoot, 'bun.lock'), `{
      "lockfileVersion": 1,
      "workspaces": {
        "packages/missing": {
          "name": "@example/missing"
        }
      }
    }`)

    expect(() => workspacePackageRows(projectRoot)).toThrow(
      'Could not read dashboard library source packages/missing/package.json: file does not exist',
    )
  })

  it('does not expose unsafe package links', () => {
    projectRoot = mkdtempSync(join(tmpdir(), 'stacks-library-package-url-'))
    mkdirSync(join(projectRoot, 'packages', 'example'), { recursive: true })
    writeFileSync(join(projectRoot, 'bun.lock'), `{
      "lockfileVersion": 1,
      "workspaces": {
        "packages/example": {
          "name": "@example/package"
        }
      }
    }`)
    writeFileSync(join(projectRoot, 'packages', 'example', 'package.json'), JSON.stringify({
      name: '@example/package',
      homepage: 'javascript:alert(1)',
      repository: 'file:///tmp/package',
    }))

    expect(workspacePackageRows(projectRoot)[0]?.url).toBe('')
  })
})
