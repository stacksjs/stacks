import { describe, expect, it } from 'bun:test'
import { appPath, frameworkPath, projectPath, storagePath } from '../src'
import {
  appPath as entrypointAppPath,
  frameworkPath as entrypointFrameworkPath,
  projectPath as entrypointProjectPath,
  storagePath as entrypointStoragePath,
} from '../src/project'

describe('project path entrypoint', () => {
  it('preserves the root entrypoint path semantics', () => {
    expect(entrypointProjectPath('package.json')).toBe(projectPath('package.json'))
    expect(entrypointAppPath('Models/User.ts')).toBe(appPath('Models/User.ts'))
    expect(entrypointStoragePath('framework')).toBe(storagePath('framework'))
    expect(entrypointFrameworkPath('core')).toBe(frameworkPath('core'))
  })
})
