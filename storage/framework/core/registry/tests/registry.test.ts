import { describe, expect, it } from 'bun:test'
import { registry } from '../src'

describe('stack registry', () => {
  it('exposes installable project sources', () => {
    expect(registry).toEqual([
      {
        name: 'calendar',
        github: 'stacksjs/calendar',
        package: '@stacksjs/calendar',
        description: 'Calendar links, ICS generation, and an STX calendar component',
      },
      {
        name: 'table',
        github: 'stacksjs/table',
        package: '@stacksjs/table',
        description: 'Typed table drivers and an STX data table component',
      },
    ])
  })
})
