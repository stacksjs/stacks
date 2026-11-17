import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { mkdir, mkdtemp, realpath, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { findStacksProjects } from '../src/find'

// stacksjs/stacks#527 — explicit `dir` arg must scan the path even if it
// lives under a default home-only exclude (Documents, Pictures, etc.).

describe('findStacksProjects', () => {
  let tempRoot: string

  /** A package-based app: no vendored framework, which is every app created today. */
  async function packageApp(...segments: string[]): Promise<string> {
    const dir = join(tempRoot, ...segments)
    await mkdir(join(dir, 'config'), { recursive: true })
    await writeFile(join(dir, 'package.json'), '{}')
    await writeFile(join(dir, 'config/app.ts'), 'export default {}')
    return dir
  }

  beforeAll(async () => {
    tempRoot = await realpath(await mkdtemp(join(tmpdir(), 'find-stacks-')))

    // A project that vendors the framework.
    await mkdir(join(tempRoot, 'sample-app', 'storage', 'framework', 'core', 'buddy'), { recursive: true })
    await writeFile(join(tempRoot, 'sample-app', 'buddy'), '#!/usr/bin/env bun\n')
    await writeFile(join(tempRoot, 'sample-app', 'package.json'), '{}')

    // A sibling that only has a file called `buddy`.
    await mkdir(join(tempRoot, 'not-a-stacks-app'), { recursive: true })
    await writeFile(join(tempRoot, 'not-a-stacks-app', 'buddy'), 'just a file\n')

    await packageApp('package-app')
    // A parent folder whose name contains "out" used to hide everything in it.
    await packageApp('layouts', 'scout', 'nested-app')
    // Dependencies and hidden folders are not searched.
    await packageApp('node_modules', 'some-dep')
    await packageApp('.cache', 'copy')
    // Nor is a project's own tree: this copy belongs to `package-app`.
    await packageApp('package-app', 'storage', 'staged', 'inner-app')
  })

  afterAll(async () => {
    await rm(tempRoot, { recursive: true, force: true })
  })

  test('finds vendored and package-based projects under the given root', async () => {
    const projects = await findStacksProjects(tempRoot, { quiet: true })
    expect(projects).toEqual([
      join(tempRoot, 'layouts', 'scout', 'nested-app'),
      join(tempRoot, 'package-app'),
      join(tempRoot, 'sample-app'),
    ])
  })

  test('skips a directory that only has a file named buddy', async () => {
    const projects = await findStacksProjects(tempRoot, { quiet: true })
    expect(projects.some(p => p.endsWith('not-a-stacks-app'))).toBe(false)
  })

  test('stops at the depth it was given', async () => {
    const projects = await findStacksProjects(tempRoot, { quiet: true, maxDepth: 1 })
    expect(projects).toEqual([join(tempRoot, 'package-app'), join(tempRoot, 'sample-app')])
  })
})
