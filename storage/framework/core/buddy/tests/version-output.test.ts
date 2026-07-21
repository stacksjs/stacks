import { describe, expect, it } from 'bun:test'
import { cli } from '@stacksjs/cli'
import { registerGlobalOptions } from '../src/global-options'
import { buddyVersion, stacksVersion, versionDescriptor, versionLine } from '../src/version-info'

describe('buddy version output', () => {
  it('reports the installed Buddy and framework package versions', () => {
    expect(versionDescriptor).toBe(`${buddyVersion} stacks/${stacksVersion}`)
    expect(versionLine).toBe(`buddy/${buddyVersion} stacks/${stacksVersion}`)
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
})
