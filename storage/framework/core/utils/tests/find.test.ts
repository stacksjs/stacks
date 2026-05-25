import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { findStacksProjects } from '../src/find'

// stacksjs/stacks#527 — explicit `dir` arg must scan the path even if it
// lives under a default home-only exclude (Documents, Pictures, etc.).

describe('findStacksProjects', () => {
  let tempRoot: string

  beforeAll(async () => {
    tempRoot = await mkdtemp(join(tmpdir(), 'find-stacks-'))

    // Build a Stacks-shaped project: `buddy` file + `storage/framework/core/buddy` dir.
    const projDir = join(tempRoot, 'sample-app')
    await mkdir(join(projDir, 'storage', 'framework', 'core', 'buddy'), { recursive: true })
    await writeFile(join(projDir, 'buddy'), '#!/usr/bin/env bun\n')

    // Build a sibling non-Stacks dir to confirm only matches come back.
    const nonProj = join(tempRoot, 'not-a-stacks-app')
    await mkdir(nonProj, { recursive: true })
    await writeFile(join(nonProj, 'buddy'), 'just a file\n')
    // (no storage/framework/core/buddy, so it shouldn't match)
  })

  afterAll(async () => {
    await rm(tempRoot, { recursive: true, force: true })
  })

  test('finds the Stacks project at the given explicit root', async () => {
    const projects = await findStacksProjects(tempRoot, { quiet: true })
    expect(projects.length).toBe(1)
    expect(projects[0]).toBe(join(tempRoot, 'sample-app'))
  })

  test('skips dirs that have buddy file but no storage/framework/core/buddy', async () => {
    const projects = await findStacksProjects(tempRoot, { quiet: true })
    expect(projects.some(p => p.endsWith('not-a-stacks-app'))).toBe(false)
  })
})
