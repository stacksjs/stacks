// What a generated app inherits as its `.github/` (stacksjs/stacks#2239).
//
// `buddy new` scaffolds by downloading this repository, so without an explicit
// step the app inherits the FRAMEWORK's `.github/` — workflows that run
// `./storage/framework/scripts/publish-commit` and measure the export size of
// `./storage/framework/core/*`. A generated app has neither path, and the
// default unvendor deletes `storage/framework` outright, so it never will.
//
// The app-shaped set lives at `defaults/vcs/github`. It was not, however,
// app-shaped: its `release.yml` was a verbatim copy of the framework's own
// release pipeline, which publishes @stacksjs/* to npm, ships the Stacks VS
// Code extension, builds the buddy binaries and pushes to stacksjs/homebrew-tap.
// Shipping THAT to an app is not an improvement over shipping the other one.
//
// So the directory being copied is only half the fix; the other half is that
// nothing in it may reference the framework's own layout. That is a property,
// not a list, which is why it is asserted by walking the tree.

import { describe, expect, test } from 'bun:test'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

/** The app-shaped template: what a generated app's `.github/` becomes. */
const APP_VCS = join(import.meta.dir, '../../../defaults/vcs/github')

/** This repository's own `.github/`: what the app used to inherit instead. */
const FRAMEWORK_VCS = join(import.meta.dir, '../../../../../.github')

const CREATE_COMMAND = join(import.meta.dir, '../src/commands/create.ts')

function filesUnder(dir: string): string[] {
  const found: string[] = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory())
      found.push(...filesUnder(full))
    else
      found.push(full)
  }
  return found
}

const appTemplateFiles = existsSync(APP_VCS) ? filesUnder(APP_VCS) : []

describe('the app CI template exists and is measurable (#2239)', () => {
  test('the template directory is present', () => {
    // create.ts degrades to a warning when this is missing, so its absence
    // would not fail a scaffold — it would silently leave the framework's own
    // workflows in the app. This is the check that keeps that from happening.
    expect(existsSync(APP_VCS)).toBeTrue()
  })

  test('it holds the workflows an app needs', () => {
    // Guards against the walk below passing because it found nothing.
    expect(appTemplateFiles.length).toBeGreaterThan(5)
    expect(existsSync(join(APP_VCS, 'workflows/ci.yml'))).toBeTrue()
    expect(existsSync(join(APP_VCS, 'workflows/release.yml'))).toBeTrue()
  })
})

describe('the app CI template is app-shaped (#2239)', () => {
  test('no file in it references the framework tree', () => {
    // The property that matters. `storage/framework` is deleted by the default
    // unvendor, so any file mentioning it is broken in every app that does not
    // pass --with-core.
    const offenders = appTemplateFiles
      .filter(file => readFileSync(file, 'utf8').includes('storage/framework'))
      .map(file => file.slice(APP_VCS.length + 1))

    expect(offenders).toEqual([])
  })

  test('no workflow runs a framework release step', () => {
    // These are the specific jobs that made the old release.yml unusable: they
    // publish the FRAMEWORK, from the app's repository, using the app's secrets.
    const forbidden = ['publish-commit', 'publish-dummy-libs', 'vsce publish', 'homebrew-tap']
    const offenders: string[] = []

    for (const file of appTemplateFiles.filter(f => f.includes('/workflows/'))) {
      const contents = readFileSync(file, 'utf8')
      for (const step of forbidden) {
        if (contents.includes(step))
          offenders.push(`${file.slice(APP_VCS.length + 1)}: ${step}`)
      }
    }

    expect(offenders).toEqual([])
  })

  test('the framework workflows really do differ (the guard is not vacuous)', () => {
    // If the framework's own `.github/` were clean too, both assertions above
    // would pass for a template that simply copied it. This proves the two sets
    // are genuinely different and that the check discriminates.
    const frameworkOffenders = filesUnder(FRAMEWORK_VCS)
      .filter(file => readFileSync(file, 'utf8').includes('storage/framework'))

    expect(frameworkOffenders.length).toBeGreaterThan(0)
  })
})

describe('the scaffold installs it (#2239)', () => {
  const source = readFileSync(CREATE_COMMAND, 'utf8')

  test('create.ts applies the template', () => {
    expect(source).toContain('applyAppVcsTemplate')
    expect(source).toContain('defaults/vcs/github')
  })

  test('it is applied before the framework tree is removed', () => {
    // Ordering is load-bearing: unvendorCore deletes storage/framework, which
    // is where the template is read from. Applied after, it would find nothing
    // and warn — leaving the framework's workflows in place, which is the bug.
    const applied = source.indexOf('applyAppVcsTemplate(path)')
    const unvendored = source.indexOf('await unvendorCore(path')

    expect(applied).toBeGreaterThan(-1)
    expect(unvendored).toBeGreaterThan(-1)
    expect(applied).toBeLessThan(unvendored)
  })

  test('the whole directory is replaced, not merged', () => {
    // A merge leaves desktop-app-store.yml, browser-extension-release.yml and
    // buddy-bot.yml behind — framework-only workflows the app cannot run.
    expect(source).toContain('rmSync(destination')
  })
})
