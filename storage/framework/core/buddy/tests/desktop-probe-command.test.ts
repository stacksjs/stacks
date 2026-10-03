// `buddy desktop:probe` (stacksjs/stacks#877) hands its options to the probe
// runner as the same flags the runner accepts as a plain script, so the two
// spellings cannot drift. This pins that translation.

import { describe, expect, test } from 'bun:test'
import { desktopProbeFlags } from '../src/commands/desktop-probe'

describe('desktopProbeFlags', () => {
  test('no options measures in Craft and prints the record', () => {
    expect(desktopProbeFlags({})).toEqual([])
  })

  test('--browser alone and with a name', () => {
    expect(desktopProbeFlags({ browser: true })).toEqual(['--browser'])
    expect(desktopProbeFlags({ browser: 'Safari' })).toEqual(['--browser=Safari'])
  })

  test('--no-open and --record pass through as switches', () => {
    expect(desktopProbeFlags({ browser: true, open: false, record: true })).toEqual(['--browser', '--no-open', '--record'])
    // cac reports `open: true` by default; that must not become a flag.
    expect(desktopProbeFlags({ open: true })).toEqual([])
  })

  test('valued options keep the runner\'s kebab-case names', () => {
    expect(desktopProbeFlags({ craftBin: '/opt/craft', interactionWindow: 0, cpuLoad: 4, out: 'r.json' }))
      .toEqual(['--out=r.json', '--craft-bin=/opt/craft', '--interaction-window=0', '--cpu-load=4'])
  })
})
