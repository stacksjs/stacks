// Where the file-based view renderer looks for components.
//
// Two different programs render `.stx` in a Stacks app. `buddy dev` and the
// production server go through `bun-plugin-stx`'s own `serve()`, which is
// handed the components, layouts and partials directories. `route.serve()`
// goes through bun-router's file routing, which was handed nothing - so its
// components directory fell back to `<viewsDir>/components`, and
// `resources/components`, where every Stacks app keeps them, was never looked
// in.
//
// The failure is silent in the direction that hides bugs: the page still
// answers 200, and each component is replaced inline with
// `[Error loading component: ENOENT ...]`. A test that boots the router and
// asserts on rendered HTML therefore cannot see any component at all, and reads
// as though the feature under test were missing rather than the harness.

import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { mkdirSync, mkdtempSync, realpathSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import process from 'node:process'
import { configureViewDirectories } from '../src/stacks-router'

/** A stand-in for bun-router: it only has to record what it was told. */
function fakeRouter(existing?: Record<string, unknown>) {
  const router: any = {
    _fileRoutingConfig: existing,
    views(config: Record<string, unknown>) {
      router.given = config

      return router
    },
  }

  return router
}

let root = ''
let previousCwd = ''

function make(...dirs: string[]): void {
  for (const dir of dirs)
    mkdirSync(join(root, dir), { recursive: true })
}

beforeEach(() => {
  // Through `realpathSync`, because macOS puts temp directories behind a
  // symlink (`/var` -> `/private/var`) and the path helper resolves it. Two
  // spellings of the same directory is a confusing way for a test to fail.
  root = realpathSync(mkdtempSync(join(tmpdir(), 'views-')))
  previousCwd = process.cwd()
  process.chdir(root)
})

afterEach(() => {
  process.chdir(previousCwd)
  rmSync(root, { recursive: true, force: true })
})

describe('configureViewDirectories', () => {
  it('points at resources/components, which is where they are', () => {
    make('resources/views', 'resources/components')

    const router = fakeRouter()
    configureViewDirectories(router)

    // The whole point. Without this the components dir defaults to
    // `resources/views/components`, which no Stacks app uses.
    expect(router.given.componentsDir).toBe(join(root, 'resources/components'))

    // And nothing about where the views are. Naming a `viewsPath` switches on
    // file-based route discovery, which walks the whole tree - an application
    // that never asked for file routing must not start doing it because a
    // directory happened to exist.
    expect(router.given.viewsPath).toBeUndefined()
  })

  it('takes resources/views/components when that is what exists', () => {
    make('resources/views', 'resources/views/components')

    const router = fakeRouter()
    configureViewDirectories(router)

    expect(router.given.componentsDir).toBe(join(root, 'resources/views/components'))
  })

  it('prefers the newer layouts location and falls back to the older one', () => {
    make('resources/views', 'resources/views/layouts', 'resources/layouts')

    const withBoth = fakeRouter()
    configureViewDirectories(withBoth)
    expect(withBoth.given.layoutsDir).toBe(join(root, 'resources/views/layouts'))

    rmSync(join(root, 'resources/views/layouts'), { recursive: true })
    const withOld = fakeRouter()
    configureViewDirectories(withOld)
    expect(withOld.given.layoutsDir).toBe(join(root, 'resources/layouts'))
  })

  it('says nothing about a directory that is not there', () => {
    // Naming a directory that does not exist is not harmless: it becomes a
    // search path that can never match, and it hides the fact that the app has
    // no partials at all.
    make('resources/views')

    const router = fakeRouter()
    configureViewDirectories(router)

    expect(router.given.partialsDir).toBeUndefined()
    expect(router.given.componentsDir).toBeUndefined()
  })

  it('leaves an application that configured this itself alone', () => {
    // Somebody who called `views()` has said something more specific than a
    // convention, and a convention must not overwrite it.
    make('resources/views', 'resources/components')

    const router = fakeRouter({ componentsDir: '/somewhere/else' })
    configureViewDirectories(router)

    expect(router.given).toBeUndefined()
  })

  it('does nothing at all when there are no views', () => {
    // An API-only application. There is nothing to render and nothing to say.
    const router = fakeRouter()
    configureViewDirectories(router)

    expect(router.given).toBeUndefined()
  })

  it('survives a router that does not know how to be told', () => {
    // A bun-router old enough to have no `views()`. Configuring it is not worth
    // taking the server down for.
    const router: any = {}
    make('resources/views', 'resources/components')

    expect(() => configureViewDirectories(router)).not.toThrow()
  })
})
