/**
 * The deploy header is one line unless you ask for more.
 *
 * `deploy` printed five lines of context - project, environment, host or
 * location and size - before any work started, and `--verbose` changed nothing:
 * the flag was read into a variable that no log call ever consulted, so the
 * default output was already the verbose output (stacksjs/stacks#853).
 *
 * The facts are identical either way. This pins that the default carries them
 * on one line and that `--verbose` still itemises them, so neither half can
 * quietly go missing.
 */
import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const source = readFileSync(
  join(new URL('../', import.meta.url).pathname, 'src/commands/deploy.ts'),
  'utf-8',
)

describe('deploy header', () => {
  it('itemises the context only under --verbose', () => {
    // The itemised block has to sit inside a verbose branch. Before this it was
    // unconditional, which is the whole bug.
    const header = source.slice(source.indexOf('🚀 Deploy →'), source.indexOf('🚀 Deploy →') + 1400)

    expect(header).toContain('if (verbose) {')
    expect(header.indexOf('if (verbose) {')).toBeLessThan(header.indexOf('Project: ${'))
  })

  it('still prints the same facts on one line by default', () => {
    const header = source.slice(source.indexOf('🚀 Deploy →'), source.indexOf('🚀 Deploy →') + 1400)
    const compact = header.slice(header.indexOf('else {'))

    // slug, environment and host - the three things the five lines carried.
    expect(compact).toContain('project?.slug')
    expect(compact).toContain('${environment}')
    expect(compact).toContain('${host}')
  })

  it('keeps `verbose` wired to the flag rather than unread', () => {
    // The regression that started this: a flag that is destructured and then
    // never consulted reads as supported and is not.
    expect(source).toContain('verbose: boolean')
    expect(source.match(/\bverbose\b/g)?.length ?? 0).toBeGreaterThan(3)
  })
})
