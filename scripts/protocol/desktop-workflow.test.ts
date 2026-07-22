import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(import.meta.dir, '../..')
const workflow = readFileSync(resolve(root, '.github/workflows/desktop-lifecycle.yml'), 'utf8')

describe('desktop lifecycle workflow', () => {
  it('packages Craft before allocating the Stacks dependency graph', () => {
    const craftInstall = workflow.indexOf('- name: Install Craft dependencies')
    const lifecycle = workflow.indexOf('- name: Exercise native package lifecycle')
    const reclaim = workflow.indexOf('- name: Reclaim Craft dependency space')
    const stacksInstall = workflow.indexOf('- name: Install Stacks dependencies')
    const stacksTests = workflow.indexOf('- name: Verify Stacks update security contracts')

    expect([craftInstall, lifecycle, reclaim, stacksInstall, stacksTests].every(index => index >= 0)).toBe(true)
    expect(craftInstall).toBeLessThan(lifecycle)
    expect(lifecycle).toBeLessThan(reclaim)
    expect(reclaim).toBeLessThan(stacksInstall)
    expect(stacksInstall).toBeLessThan(stacksTests)
    expect(workflow).toContain('rm -rf .craft-contract/node_modules')
  })

  it('provisions explicit macOS descriptor capacity for Bun installs', () => {
    expect(workflow.match(/ulimit -n 65536/g)).toHaveLength(2)
    expect(workflow).toContain('if [ "$RUNNER_OS" = "macOS" ]')
  })

  it('uses a compatible preinstalled WiX 3.14 before installing it', () => {
    const discovery = workflow.indexOf('$bin = Get-ChildItem')
    const install = workflow.indexOf('choco install wixtoolset')

    expect(discovery).toBeGreaterThan(0)
    expect(discovery).toBeLessThan(install)
    expect(workflow).toContain("$version.StartsWith('3.14')")
    expect(workflow).toContain('--allow-downgrade')
  })
})
