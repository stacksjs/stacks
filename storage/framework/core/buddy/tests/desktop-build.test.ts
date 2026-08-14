import { describe, expect, it } from 'bun:test'
import { cli } from '@stacksjs/cli'
import type { BuildOptions } from '@stacksjs/types'
import { applyBuildTarget, build } from '../src/commands/build'

describe('desktop build command', () => {
  it('supports desktop as a positional and dashed build target', () => {
    const options = {} as BuildOptions
    applyBuildTarget('desktop', options)
    expect(options.desktop).toBeTrue()

    const buddy = cli('buddy')
    build(buddy)
    const command = buddy.commands.find(candidate => candidate.name === 'build')
    expect(command?.options.some(option => option.name === 'desktop')).toBeTrue()
  })

  it('supports native mobile build targets', () => {
    const options = {} as BuildOptions
    applyBuildTarget('android', options)
    applyBuildTarget('ios', options)
    expect(options.android).toBeTrue()
    expect(options.ios).toBeTrue()

    const buddy = cli('buddy')
    build(buddy)
    const command = buddy.commands.find(candidate => candidate.name === 'build')
    expect(command?.options.some(option => option.name === 'android')).toBeTrue()
    expect(command?.options.some(option => option.name === 'ios')).toBeTrue()
  })
})
