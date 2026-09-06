/**
 * The unvendor install honours the project's dependency layout.
 *
 * `pantry install` defaults to the isolated layout whatever `bunfig.toml` asks
 * for, which puts a transitive package at
 * `node_modules/.bun/@types+bun@1.4.1/node_modules/@types/bun`. TypeScript's
 * default `typeRoots` walks `node_modules/@types` upward and never looks there,
 * so a scaffolded app failed its first typecheck with
 *
 *     error TS2688: Cannot find type definition file for 'bun'
 *
 * even though `better-dx`, which ships `@types/bun`, was installed. Measured
 * both ways: `pantry install` leaves one entry in `node_modules` and no
 * `@types`; `pantry install --linker hoisted` leaves 27 and the types are
 * there.
 *
 * AGENTS.md already requires `linker = "hoisted"` wherever `better-dx` is a
 * dependency, so this is the install catching up with the rule rather than a
 * new one.
 */
import { describe, expect, it } from 'bun:test'
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { detectInstaller } from '../src/unvendor-rewrite'

function project(files: Record<string, string>, dirs: string[] = []): string {
  const dir = mkdtempSync(join(tmpdir(), 'installer-linker-'))
  for (const sub of dirs)
    mkdirSync(join(dir, sub), { recursive: true })
  for (const [name, contents] of Object.entries(files))
    writeFileSync(join(dir, name), contents)
  return dir
}

describe('detectInstaller', () => {
  it('asks pantry for the hoisted layout when bunfig does', () => {
    const dir = project({ 'bunfig.toml': '[install]\nlinker = "hoisted"\n' }, ['pantry'])

    // Only meaningful where pantry is the installer at all.
    if (!Bun.which('pantry'))
      return

    expect(detectInstaller(dir)).toEqual(['pantry', 'install', '--linker', 'hoisted'])
  })

  it('leaves the layout alone when bunfig says nothing', () => {
    const dir = project({ 'bunfig.toml': '[install]\nregistry = "https://registry.npmjs.org/"\n' }, ['pantry'])
    if (!Bun.which('pantry'))
      return

    expect(detectInstaller(dir)).toEqual(['pantry', 'install'])
  })

  it('still prefers bun for a project that does not use pantry', () => {
    const dir = project({ 'bunfig.toml': '[install]\nlinker = "hoisted"\n' }, ['node_modules'])

    expect(detectInstaller(dir)).toEqual(['bun', 'install'])
  })

  it('survives a project with no bunfig at all', () => {
    const dir = project({}, ['pantry'])
    if (!Bun.which('pantry'))
      return

    expect(detectInstaller(dir)).toEqual(['pantry', 'install'])
  })
})
