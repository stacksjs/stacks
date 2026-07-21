import { describe, expect, it } from 'bun:test'
import { cli } from '@stacksjs/cli'
import { xRay, xRayLaunchCommand } from '../src/commands/x-ray'

describe('X-Ray command', () => {
  it('registers X-Ray and forwards only explicit controls', () => {
    const buddy = cli('buddy')
    xRay(buddy)
    expect(buddy.commands.some(command => command.name === 'x-ray')).toBeTrue()

    expect(xRayLaunchCommand({
      url: 'https://example.test',
      port: '3100',
      window: false,
    }, '/tmp/project', '/tmp/missing-x-ray-cli')).toEqual([
      'bunx',
      '--bun',
      '@stacksjs/x-ray',
      '--project',
      '/tmp/project',
      '--url',
      'https://example.test',
      '--port',
      '3100',
      '--no-window',
    ])
  })
})
