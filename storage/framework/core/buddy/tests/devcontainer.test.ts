import { existsSync, readFileSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { describe, expect, it } from 'bun:test'

/**
 * The devcontainer stays true to the project it bootstraps
 * (stacksjs/stacks#236).
 *
 * A Codespace is the one environment nobody tests before shipping: it is
 * built from this file on somebody else's machine, and a stale command or a
 * missing script fails there with no local signal at all. These assertions
 * are the signal.
 */

// tests -> buddy -> core -> framework -> storage -> repo root
const repoRoot = dirname(dirname(dirname(dirname(dirname(import.meta.dir)))))
const devcontainerDir = join(repoRoot, '.devcontainer')

/** devcontainer.json is JSONC; comments are part of the format. */
function readJsonc(path: string): any {
  const source = readFileSync(path, 'utf8')
  return JSON.parse(source.replace(/^\s*\/\/.*$/gm, ''))
}

describe('.devcontainer', () => {
  const configPath = join(devcontainerDir, 'devcontainer.json')

  it('exists and parses as JSONC', () => {
    expect(existsSync(configPath)).toBeTrue()
    expect(readJsonc(configPath).name).toBe('Stacks')
  })

  it('points postCreateCommand at a script that exists and is executable', () => {
    // The failure this catches is silent until somebody opens a Codespace:
    // a renamed or non-executable script means the container comes up with
    // no toolchain and no explanation.
    const config = readJsonc(configPath)
    const script = join(repoRoot, config.postCreateCommand)

    expect(existsSync(script)).toBeTrue()
    // Owner-executable bit.
    expect(statSync(script).mode & 0o100).toBeGreaterThan(0)
  })

  it('recommends the extension the framework itself recommends', () => {
    // Two lists of recommendations drift. This asserts there is one.
    const config = readJsonc(configPath)
    const shipped = JSON.parse(readFileSync(
      join(repoRoot, 'storage/framework/defaults/ide/vscode/.vscode/extensions.json'),
      'utf8',
    ))

    expect(config.customizations.vscode.extensions).toEqual(shipped.recommendations)
  })

  it('forwards ports the project actually serves on', () => {
    // Not an exhaustive match: `config/ports.ts` declares more than a
    // Codespace needs forwarded. But every forwarded port must be one of them,
    // or the label is a lie.
    const config = readJsonc(configPath)
    const declared = readFileSync(join(repoRoot, 'config/ports.ts'), 'utf8')
    const known = new Set([...declared.matchAll(/\?\?\s*(\d{4})|:\s*(\d{4}),/g)]
      .map(match => Number(match[1] ?? match[2])))

    for (const port of config.forwardPorts)
      expect(known.has(port)).toBeTrue()
  })

  it('labels every port it forwards', () => {
    const config = readJsonc(configPath)
    for (const port of config.forwardPorts)
      expect(config.portsAttributes[String(port)]?.label).toBeTruthy()
  })
})

describe('.devcontainer/setup.sh', () => {
  const script = readFileSync(join(devcontainerDir, 'setup.sh'), 'utf8')

  it('fails the container build rather than continuing past an error', () => {
    // Without `-e`, a failed `bun install` leaves a container that looks ready
    // and is not.
    expect(script).toContain('set -euo pipefail')
  })

  it('runs only buddy commands that exist', () => {
    // The rot this guards: `buddy setup` gains a flag, loses one, or is
    // renamed, and the Codespace bootstrap keeps calling the old spelling.
    const invoked = [...script.matchAll(/\.\/buddy\s+([\w:-]+)/g)].map(match => match[1]!)
    expect(invoked.length).toBeGreaterThan(0)

    const registry = readFileSync(
      join(repoRoot, 'storage/framework/core/buddy/src/lazy-commands.ts'),
      'utf8',
    )

    for (const command of invoked)
      expect(registry).toContain(`'${command}'`)
  })

  it('installs the toolchain through Pantry, not a bare Bun', () => {
    // Pantry PINS Bun for this workspace. Installing Bun directly pins
    // nothing and drifts from what CI resolves.
    expect(script).toContain('pantry bootstrap')
  })
})
