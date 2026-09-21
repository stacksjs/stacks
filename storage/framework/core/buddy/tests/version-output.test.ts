import { describe, expect, it } from 'bun:test'
import { cli } from '@stacksjs/cli'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import process from 'node:process'
import { upgrade } from '../src/commands/upgrade'
import { registerGlobalOptions } from '../src/global-options'
import { buddyVersion, stacksVersion, versionDescriptor, versionLine } from '../src/version-info'

describe('buddy version output', () => {
  it('reports the installed Buddy and framework package versions', () => {
    expect(stacksVersion).toBe(buddyVersion)
    expect(versionDescriptor).toBe(`${buddyVersion} stacks/${stacksVersion}`)
    expect(versionLine).toBe(`buddy/${buddyVersion} stacks/${stacksVersion}`)
  })

  it('answers every pure version form without loading application environment', async () => {
    const cliEntry = resolve(import.meta.dir, '../src/cli.ts')

    for (const argument of ['--version', '-V', 'version']) {
      const child = Bun.spawn([process.execPath, cliEntry, argument], {
        cwd: tmpdir(),
        stderr: 'pipe',
        stdout: 'pipe',
      })
      const [stdout, stderr, exitCode] = await Promise.all([
        new Response(child.stdout).text(),
        new Response(child.stderr).text(),
        child.exited,
      ])

      expect(exitCode).toBe(0)
      expect(stdout.trim()).toBe(`${versionLine} ${process.platform}-${process.arch} bun-v${Bun.version}`)
      expect(stderr).not.toContain('[env]')
    }
  })

  it('keeps lowercase -v for verbose and uppercase -V for version', () => {
    const buddy = cli('buddy')
    registerGlobalOptions(buddy)

    const versionOption = buddy.globalCommand.options.find(option => option.name === 'version')
    const verboseOption = buddy.globalCommand.options.find(option => option.name === 'verbose')

    expect(versionOption?.names).toContain('V')
    expect(versionOption?.names).not.toContain('v')
    expect(verboseOption?.names).toContain('v')
  })

  it('leaves the version names command-scoped for upgrade targets', () => {
    const buddy = cli('buddy')
    registerGlobalOptions(buddy, { version: false })
    upgrade(buddy)

    const globalVersion = buddy.globalCommand.options.find(option => option.name === 'version')
    const upgradeCommand = buddy.commands.find(command => command.name === 'upgrade')
    const targetVersion = upgradeCommand?.options.find(option => option.name === 'version')

    expect(globalVersion).toBeUndefined()
    expect(targetVersion?.names).toContain('V')
    expect(targetVersion?.names).toContain('version')
  })
})
