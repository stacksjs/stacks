import { afterEach, describe, expect, it } from 'bun:test'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { autoLoadEnv, environmentFiles } from '../src/plugin'

/**
 * Which env files the app loads, and in which order, is what a tool editing
 * them has to agree with: the last file that sets a key is the one the app
 * reads it from (stacksjs/stacks#3340).
 */
const directories: string[] = []

function project(files: Record<string, string>): string {
  const directory = mkdtempSync(join(tmpdir(), 'stacks-env-files-'))
  directories.push(directory)
  for (const [name, content] of Object.entries(files))
    writeFileSync(join(directory, name), content)
  return directory
}

afterEach(() => {
  for (const directory of directories.splice(0))
    rmSync(directory, { recursive: true, force: true })
})

describe('environmentFiles', () => {
  it('lists the files that exist, least specific first', () => {
    const directory = project({
      '.env.staging.local': '',
      '.env': '',
      '.env.staging': '',
      '.env.local': '',
      '.env.production': '',
    })
    expect(environmentFiles('staging', directory)).toEqual(['.env', '.env.local', '.env.staging', '.env.staging.local'])
  })

  it('leaves out the files that do not exist', () => {
    expect(environmentFiles('staging', project({ '.env.staging': '' }))).toEqual(['.env.staging'])
    expect(environmentFiles('staging', project({}))).toEqual([])
  })

  it('is the order autoLoadEnv loads them in: the last file that sets a key wins', () => {
    const key = 'STACKS_ENVIRONMENT_FILES_PROBE'
    const directory = project({
      '.env': `${key}=base\n`,
      '.env.local': `${key}=local\n`,
      '.env.staging': `${key}=staging\n`,
    })
    const files = environmentFiles('staging', directory)
    delete process.env[key]
    try {
      autoLoadEnv({ cwd: directory, env: 'staging', quiet: true })
      expect(files.at(-1)).toBe('.env.staging')
      expect(process.env[key]).toBe('staging')
    }
    finally {
      delete process.env[key]
    }
  })
})
