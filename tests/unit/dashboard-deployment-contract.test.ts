import { describe, expect, test } from 'bun:test'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const components = resolve('storage/framework/defaults/resources/components/Dashboard/Deployments')
const actions = resolve('storage/framework/defaults/app/Actions/Dashboard/Deployments')

function component(name: string): string {
  return readFileSync(resolve(components, name), 'utf8')
}

function action(name: string): string {
  return readFileSync(resolve(actions, name), 'utf8')
}

describe('dashboard deployment contract', () => {
  test('composes every deployment capability on the canonical page', () => {
    const list = component('DeploymentList.stx')

    expect(list).toContain('<DeploymentTable')
    expect(list).toContain('<DeployScript />')
    expect(list).toContain('<LiveTerminalOutput />')
    expect(list).toContain("openDeploymentDialog('preview')")
    expect(list).toContain("openDeploymentDialog('deploy')")
    expect(list).toContain('/api/dashboard/deployments/preview')
    expect(list).toContain('<DeploymentPreviewDialog')
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

  test('only renders safe absolute deployment links', () => {
    const detail = component('DeploymentDetail.stx')

    expect(detail).toContain("url.protocol === 'http:' || url.protocol === 'https:'")
    expect(detail).toContain('<div :if="deploymentUrl()">')
    expect(detail).toContain(':href="deploymentUrl()"')
    expect(detail).not.toContain("|| '#'")
  })

  test('removes the disconnected legacy activity feed', () => {
    expect(existsSync(resolve(components, 'ActivityFeed.stx'))).toBe(false)
  })

  test('keeps operational failures private while preserving input validation', () => {
    const reads = [
      'GetAverageDeploymentTime.ts',
      'GetDeployment.ts',
      'GetDeploymentCount.ts',
      'GetDeploymentLiveTerminalOutput.ts',
      'GetDeployments.ts',
      'GetDeployScript.ts',
      'GetRecentDeployments.ts',
    ].map(action).join('\n')
    const create = action('CreateDeployment.ts')
    const updateScript = action('UpdateDeployScript.ts')

    expect(reads).not.toContain('error instanceof Error ? error.message')
    expect(reads.match(/dashboardOperationalError\(/g)?.length).toBe(7)
    expect(action('GetDeployment.ts')).toContain('!Number.isSafeInteger(id) || id <= 0')
    expect(action('GetDeployment.ts')).toContain("response.json({ message: 'Deployment id must be a positive integer.' }, 400)")
    expect(create.match(/dashboardOperationalError\(/g)?.length).toBe(3)
    expect(create.match(/dashboardOperationalIssue\(/g)?.length).toBe(2)
    expect(create.match(/error instanceof Error \? error\.message/g)?.length).toBe(2)
    expect(create).toContain('runDeploymentPreview(previewArgs)')
    expect(create).toContain('Deployment preview generated.')
    expect(updateScript.match(/dashboardOperationalError\(/g)?.length).toBe(1)
    expect(updateScript.match(/dashboardOperationalIssue\(/g)?.length).toBe(1)
    expect(updateScript.match(/error instanceof Error \? error\.message/g)?.length).toBe(1)
  })

  test('saves deploy scripts atomically per request', () => {
    const updateScript = action('UpdateDeployScript.ts')

    expect(updateScript).toContain('`${filePath}.${randomUUIDv7()}.tmp`')
    expect(updateScript).toContain('await rename(temporaryPath, filePath)')
    expect(updateScript).toContain('await rm(temporaryPath, { force: true })')
  })

  test('never exposes an absolute deployment log path', () => {
    const terminal = action('GetDeploymentLiveTerminalOutput.ts')

    expect(terminal).toContain('const relativePath = relative(process.cwd(), filePath)')
    expect(terminal).toContain("!isAbsolute(relativePath)")
    expect(terminal).toContain("'deployments.log'")
    expect(terminal).not.toContain('path: configuredPath')
  })
})
