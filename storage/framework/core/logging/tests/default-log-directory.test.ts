/**
 * Where the file transport writes when config names no logsPath.
 *
 * Inside a project it is the project's storage/logs. Outside one - `buddy new
 * my-app` run from ~/Code, usually as `panx buddy new` - it used to be
 * `<cwd>/storage/logs` too, so every scaffold left a stray storage/ beside the
 * app it created. Outside a project it now goes to a per-user cache.
 */
import { describe, expect, test } from 'bun:test'
import { defaultLogDirectory } from '../src/index'

describe('defaultLogDirectory', () => {
  test('a project logs into its own storage/logs', () => {
    const exists = (path: string) => path === '/apps/shop/package.json'
    expect(defaultLogDirectory('/apps/shop', exists, '/home/ana')).toBe('/apps/shop/storage/logs')
  })

  test('a directory with a storage/ but no package.json is still a project', () => {
    const exists = (path: string) => path === '/apps/legacy/storage'
    expect(defaultLogDirectory('/apps/legacy', exists, '/home/ana')).toBe('/apps/legacy/storage/logs')
  })

  test('outside any project, logs go to the user cache, not the working directory', () => {
    const exists = () => false
    expect(defaultLogDirectory('/home/ana/Code', exists, '/home/ana')).toBe('/home/ana/.cache/stacks/logs')
  })
})
