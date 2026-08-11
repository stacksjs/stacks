/**
 * What `unpublish:core --all` leaves behind in CI.
 *
 * A scaffolded project IS the framework, and its CI file says so: jobs that
 * build every package under `storage/framework/core`, run every package's
 * tests, and compile the CLI binary. Unvendoring deletes that directory and
 * used to leave those jobs in place, where they fail by construction — the
 * per-package test loop has nothing to expand, so the glob passes through
 * literally and the job reports `Failing core packages: *`.
 *
 * Nobody connects that to an unvendor from weeks earlier. The pipeline simply
 * stays red, and a red pipeline says nothing about the change that just landed:
 * one app ran that way for its entire history, and the framework fix it was
 * hiding took a person reading the logs by hand to find.
 */

import { describe, expect, it } from 'bun:test'
import { pruneVendoredCoreFromWorkflow, splitFrameworkTypecheckScript } from '../src/workflow-prune'

/** The shape of the scaffold's own CI, reduced to what matters here. */
const WORKFLOW = `name: CI

on:
  push:
    branches: [main]

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6

      - name: Lint
        run: bun buddy lint

  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6

      - name: Test Suite
        run: bun run test

      # One \`bun test\` per package: the whole tree at once segfaults.
      - name: Core tests (all packages)
        run: |
          for dir in storage/framework/core/*/tests; do
            bun test "./$dir"
          done

  compile:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6

      - name: Compile the buddy binary
        run: |
          cd storage/framework/core/buddy
          bun run compile:linux-x64

  deploy:
    needs: [lint, test, compile]
    runs-on: ubuntu-latest
    steps:
      - name: Deploy
        run: ./buddy deploy
`

describe('pruning the framework CI out of an unvendored project', () => {
  const pruned = pruneVendoredCoreFromWorkflow(WORKFLOW)

  it('drops a job whose every step ran against the vendored core', () => {
    expect(pruned.removedJobs).toEqual(['compile'])
    expect(pruned.yaml).not.toContain('compile:linux-x64')
  })

  it('drops only the offending step from a job that also does real work', () => {
    // The app's own `bun run test` is the reason this job exists.
    expect(pruned.yaml).not.toContain('Core tests (all packages)')
    expect(pruned.yaml).toContain('Test Suite')
    expect(pruned.yaml).toContain('run: bun run test')
    expect(pruned.removedSteps).toBe(1)
  })

  it('takes the comment that explained the step with it', () => {
    expect(pruned.yaml).not.toContain('segfaults')
  })

  it('repairs the `needs:` list that named a job it removed', () => {
    // A `needs:` naming a job that no longer exists is not a warning — GitHub
    // refuses to run the whole workflow.
    expect(pruned.yaml).toContain('needs: [lint, test]')
  })

  it('leaves everything else alone', () => {
    expect(pruned.yaml).toContain('  lint:')
    expect(pruned.yaml).toContain('  test:')
    expect(pruned.yaml).toContain('  deploy:')
    expect(pruned.yaml).toContain('run: bun buddy lint')
    expect(pruned.yaml).toContain('run: ./buddy deploy')
    expect(pruned.yaml.startsWith('name: CI')).toBe(true)
  })

  it('is a no-op on a workflow that never mentions the core', () => {
    const app = `name: Deploy

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Deploy
        run: ./buddy deploy
`

    expect(pruneVendoredCoreFromWorkflow(app).yaml).toBe(app)
  })

  it('does not act on a comment that merely mentions the path', () => {
    /*
     * Workflows explain themselves, and several of those explanations name the
     * directory precisely because the project no longer has one. Removing a job
     * over its own documentation would be the worst kind of surprise.
     */
    const documented = `name: CI

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      # Resolves from npm rather than a vendored storage/framework/core.
      - name: Build
        run: bun run build
`

    const result = pruneVendoredCoreFromWorkflow(documented)

    expect(result.yaml).toBe(documented)
    expect(result.removedJobs).toEqual([])
  })

  it('leaves the last job removable without corrupting the file', () => {
    const trailing = `name: CI

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - name: Lint
        run: bun buddy lint

  compile:
    runs-on: ubuntu-latest
    steps:
      - name: Compile
        run: cd storage/framework/core/buddy && bun run compile
`

    const result = pruneVendoredCoreFromWorkflow(trailing)

    expect(result.removedJobs).toEqual(['compile'])
    expect(result.yaml).toContain('run: bun buddy lint')
    expect(result.yaml).not.toContain('compile')
  })
})

/**
 * The other thing an unvendor left pointing at the framework.
 *
 * `typecheck` ran the framework's tsconfig project, which excludes `app/`,
 * `config/`, `resources/` and `routes/` by design — they belong to the root
 * project. In an app that means the command everyone runs, and the one CI
 * calls, reports zero errors on code it never opened.
 */
describe('splitFrameworkTypecheckScript', () => {
  const scaffold = {
    build: './buddy build',
    typecheck: 'bun x --bun tsc --noEmit -p storage/framework/tsconfig.framework.json --pretty false',
    'typecheck:app': 'bun x --bun tsc --noEmit -p tsconfig.json --pretty false',
  }

  it('makes `typecheck` cover the app as well', () => {
    const next = splitFrameworkTypecheckScript(scaffold)

    expect(next?.typecheck).toBe('bun run typecheck:app && bun run typecheck:framework')
  })

  it('keeps the framework check, under its own name', () => {
    // The vendored `storage/framework/**` files an app still ships — its
    // generated types, ORM entrypoint and defaults — are worth checking.
    expect(splitFrameworkTypecheckScript(scaffold)?.['typecheck:framework']).toBe(scaffold.typecheck)
  })

  it('leaves every other script untouched, in order', () => {
    const next = splitFrameworkTypecheckScript(scaffold)!

    expect(next.build).toBe('./buddy build')
    expect(Object.keys(next)).toEqual(['build', 'typecheck', 'typecheck:framework', 'typecheck:app'])
  })

  it('does nothing to a project that already checks itself', () => {
    expect(splitFrameworkTypecheckScript({ typecheck: 'tsc --noEmit -p tsconfig.json' })).toBeNull()
  })

  it('does nothing without a `typecheck:app` to delegate to', () => {
    // Nothing to split into; guessing at the app's project would be worse than
    // leaving a script the developer can see and change.
    expect(splitFrameworkTypecheckScript({ typecheck: scaffold.typecheck })).toBeNull()
  })
})

describe('the framework publish script', () => {
  it('goes too — it walks the source tree that was just deleted', () => {
    const withPublish = `name: CI

jobs:
  publish-commit:
    if: github.event_name == 'pull_request'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6

      - name: Install Dependencies
        run: bun install --frozen-lockfile

      - name: Publish Commit
        run: ./storage/framework/scripts/publish-commit
`

    const result = pruneVendoredCoreFromWorkflow(withPublish)

    expect(result.removedJobs).toEqual(['publish-commit'])
  })
})
