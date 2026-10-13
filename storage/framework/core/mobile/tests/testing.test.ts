import { expect, test } from 'bun:test'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { prepareIosSimulatorDriver, serializeSimulatorSteps } from '../src/testing'

test('the Stacks driver derives the installed app and tabs from mobile config', () => {
  const root = mkdtempSync(join(tmpdir(), 'stacks-driver-'))
  try {
    const driver = prepareIosSimulatorDriver({
      appName: 'Example', bundleId: 'org.example.app', tabs: [{ id: '/', title: 'Home' }],
      simulator: { projectName: 'ExampleDriver', controlUrl: 'http://localhost:4444' },
    }, root)
    expect(driver.output).toBe(join(root, 'storage/framework/mobile/ios-driver'))
    expect(driver.projectName).toBe('ExampleDriver')
    const source = readFileSync(join(driver.output, 'UITests/DriverTests.swift'), 'utf8')
    expect(source).toContain('"org.example.app"')
    expect(source).toContain('let tabs: [String] = ["Home"]')
    expect(source).toContain('http://localhost:4444')
    expect(serializeSimulatorSteps([{ command: 'launch' }])).toBe('launch\n')
  }
  finally { rmSync(root, { recursive: true, force: true }) }
})
