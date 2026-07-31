import { describe, expect, test } from 'bun:test'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const components = resolve('storage/framework/defaults/resources/components/Dashboard/Deployments')

function component(name: string): string {
  return readFileSync(resolve(components, name), 'utf8')
}

describe('dashboard deployment contract', () => {
  test('composes every deployment capability on the canonical page', () => {
    const list = component('DeploymentList.stx')

    expect(list).toContain('<DeploymentTable')
    expect(list).toContain('<DeployScript />')
    expect(list).toContain('<LiveTerminalOutput />')
    expect(list).toContain('<Button :disabled="isStarting()" @click="showDeployModal.set(true)">')
    expect(list).not.toContain('from-blue-500')
  })

  test('uses native STX lifecycle and the canonical button component', () => {
    const script = component('DeployScript.stx')
    const terminal = component('LiveTerminalOutput.stx')

    expect(script).toContain("import { fetchDeployScript, updateDeployScript }")
    expect(script).toContain('v-model:value="content"')
    expect(script).toContain('<Button')
    expect(script).not.toContain('<button')
    expect(script).not.toMatch(/\b(?:document|window)\./)

    expect(terminal).toContain("import { fetchDeploymentTerminal }")
    expect(terminal).toContain('useDocumentVisibility()')
    expect(terminal).toContain('useIntervalFn(')
    expect(terminal).toContain('onDestroy(')
    expect(terminal).toContain('pauseRefresh()')
    expect(terminal).toContain('<Button')
    expect(terminal).not.toContain('<button')
    expect(terminal).not.toMatch(/\b(?:document|window)\./)
  })

  test('removes the disconnected legacy activity feed', () => {
    expect(existsSync(resolve(components, 'ActivityFeed.stx'))).toBe(false)
  })
})
