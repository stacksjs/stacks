// `buddy publish:model` has to publish a file that RUNS.
//
// It did a bare copyFile, so `publish:model User` landed an app/Models/User.ts
// importing `../password-policy` - a path that resolves inside
// storage/framework/defaults/app/ and nowhere else. The app got the model and
// not the policy, the import threw, and the ORM fell back to the framework
// default: the published override was inert, edits to it did nothing, and the
// first visible symptom was `buddy generate:migrations` failing with a module
// resolution error that named neither the command nor the model.
//
// Publishing the User model is the documented way to enable `billable`, so
// this was on the path of every app that bills.

import { describe, expect, test } from 'bun:test'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { copyFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
// Imported up here, not inside the test: loading this module pulls in the CLI,
// which discovers models under the CURRENT working directory. Importing it
// after chdir'ing into the fixture makes the framework try to load the
// half-published model and throw the very error the test is about to fix.
import { carryRelativeImports } from '../src/commands/publish'

const PUBLISH_COMMAND = join(import.meta.dir, '../src/commands/publish.ts')
const DEFAULT_USER = join(import.meta.dir, '../../../defaults/app/Models/User.ts')
const DEFAULT_POLICY = join(import.meta.dir, '../../../defaults/app/password-policy.ts')

describe('the default models are publishable at all', () => {
  test('the User model imports its password policy relatively', () => {
    // If this stops being true the bug cannot recur, and the machinery below
    // is guarding nothing. Kept as a real assertion rather than a comment.
    expect(existsSync(DEFAULT_USER)).toBeTrue()
    expect(readFileSync(DEFAULT_USER, 'utf8')).toContain('from \'../password-policy\'')
  })

  test('the policy it imports exists next to the app directory, not beside the model', () => {
    expect(existsSync(DEFAULT_POLICY)).toBeTrue()
    expect(existsSync(join(import.meta.dir, '../../../defaults/app/Models/password-policy.ts'))).toBeFalse()
  })
})

describe('publishing carries the modules a file imports', () => {
  const source = readFileSync(PUBLISH_COMMAND, 'utf8')

  test('publishResource copies relative imports alongside the file', () => {
    expect(source).toContain('carryRelativeImports(sourcePath, targetPath)')
  })

  test('it recurses, so a dependency brings its own siblings', () => {
    expect(source).toContain('carryRelativeImports(from, to, seen)')
  })

  test('it refuses to write outside the project root', () => {
    // A specifier climbing past the app root would otherwise let a template
    // bug write anywhere on disk.
    expect(source).toMatch(/if \(!to\.startsWith\(`\$\{root\}\/`\)\)/)
  })

  test('it does not overwrite a file the app already has', () => {
    // The app's own copy is the point of publishing; clobbering it on a second
    // publish would discard the edits that made it worth publishing.
    expect(source).toContain('if (!existsSync(to)) {')
  })
})

// The behaviour itself, run against a real directory tree rather than asserted
// from the source text.
describe('carryRelativeImports, end to end', () => {
  test('a published model resolves its relative import in the new location', async () => {
    const root = mkdtempSync(join(tmpdir(), 'stacks-publish-'))
    const cwd = process.cwd()

    try {
      const defaults = join(root, 'storage/framework/defaults/app')
      const app = join(root, 'app')
      mkdirSync(join(defaults, 'Models'), { recursive: true })
      mkdirSync(join(app, 'Models'), { recursive: true })

      writeFileSync(join(defaults, 'password-policy.ts'), 'export const PASSWORD_MIN_LENGTH = 8\n')
      writeFileSync(join(defaults, 'Models/User.ts'), 'import { PASSWORD_MIN_LENGTH } from \'../password-policy\'\nexport default { PASSWORD_MIN_LENGTH }\n')

      // Mirror what publishResource does: copy the file, then carry its imports.
      const sourcePath = join(defaults, 'Models/User.ts')
      const targetPath = join(app, 'Models/User.ts')

      await copyFile(sourcePath, targetPath)

      process.chdir(root)
      const carried = await carryRelativeImports(sourcePath, targetPath)

      expect(existsSync(join(app, 'password-policy.ts'))).toBeTrue()
      expect(carried.some(file => file.endsWith('password-policy.ts'))).toBeTrue()

      // And the published model actually imports now.
      const imported = await import(targetPath)
      expect(imported.default.PASSWORD_MIN_LENGTH).toBe(8)
    }
    finally {
      process.chdir(cwd)
      rmSync(root, { recursive: true, force: true })
    }
  })
})
