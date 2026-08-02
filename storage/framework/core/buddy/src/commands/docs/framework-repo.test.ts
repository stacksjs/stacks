import { describe, expect, it } from 'bun:test'
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { assertFrameworkRepo, isInsideRoot, looksLikeFrameworkRepo } from './framework-repo'

/**
 * The docs tools locate their files by counting `../` up from their own source,
 * so the root they edit is wherever the module happens to live. An application
 * that resolves buddy from a linked framework checkout therefore ran
 * `docs:artifacts` against the FRAMEWORK's tree - regenerating its
 * `openapi.json` from a different project's routes.
 *
 * What surfaced first was milder and more misleading: the generator read the
 * app's routes, compared them to the framework's artifact, and said "no routes
 * were registered". Nothing in that message suggests another repository was
 * being written to.
 */
describe('isInsideRoot', () => {
  it('accepts the root itself and anything under it', () => {
    expect(isInsideRoot('/a/b', '/a/b')).toBe(true)
    expect(isInsideRoot('/a/b', '/a/b/c/d')).toBe(true)
  })

  it('rejects a sibling and a parent', () => {
    expect(isInsideRoot('/a/b', '/a/c')).toBe(false)
    expect(isInsideRoot('/a/b', '/a')).toBe(false)
  })

  /** The case that mattered: two unrelated checkouts side by side. */
  it('rejects another project entirely', () => {
    expect(isInsideRoot('/Users/x/Code/stacks', '/Users/x/Code/Apps/reviewos.org')).toBe(false)
  })
})

describe('looksLikeFrameworkRepo', () => {
  it('recognises a tree carrying the framework core', () => {
    const dir = mkdtempSync(join(tmpdir(), 'stacks-fw-'))
    try {
      mkdirSync(resolve(dir, 'storage/framework/core/buddy'), { recursive: true })
      expect(looksLikeFrameworkRepo(dir)).toBe(true)
    }
    finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('does not mistake an ordinary application for it', () => {
    const dir = mkdtempSync(join(tmpdir(), 'stacks-app-'))
    try {
      mkdirSync(resolve(dir, 'app'), { recursive: true })
      expect(looksLikeFrameworkRepo(dir)).toBe(false)
    }
    finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})

describe('assertFrameworkRepo', () => {
  it('passes inside the framework repo', () => {
    const dir = mkdtempSync(join(tmpdir(), 'stacks-fw-'))
    try {
      mkdirSync(resolve(dir, 'storage/framework/core/buddy'), { recursive: true })
      expect(() => assertFrameworkRepo(dir, 'docs:artifacts', dir)).not.toThrow()
    }
    finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  /**
   * Throws rather than warns. The alternative is silently rewriting a file in a
   * repository the caller is not looking at.
   */
  it('refuses when run from somewhere else, and says where it would have written', () => {
    const framework = mkdtempSync(join(tmpdir(), 'stacks-fw-'))
    const app = mkdtempSync(join(tmpdir(), 'stacks-app-'))
    try {
      mkdirSync(resolve(framework, 'storage/framework/core/buddy'), { recursive: true })
      expect(() => assertFrameworkRepo(framework, 'docs:artifacts', app)).toThrow(/docs:artifacts/)
      expect(() => assertFrameworkRepo(framework, 'docs:artifacts', app)).toThrow(new RegExp(framework))
    }
    finally {
      rmSync(framework, { recursive: true, force: true })
      rmSync(app, { recursive: true, force: true })
    }
  })

  it('refuses when the root is not a framework tree at all', () => {
    const dir = mkdtempSync(join(tmpdir(), 'stacks-app-'))
    try {
      expect(() => assertFrameworkRepo(dir, 'docs:links', dir)).toThrow()
    }
    finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})
