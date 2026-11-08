import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { buildRecipe } from '../../storage/framework/defaults/ai/skills/stacks-marketing-conversion-tracking/scripts/build-recipe'

const root = new URL('../../storage/framework/defaults/ai/skills/stacks-marketing-conversion-tracking/assets/gtm-recipes/', import.meta.url)
const tools = Object.keys(JSON.parse(readFileSync(new URL('event-map.json', root), 'utf8')))
const destinations: Record<string, Record<string, string>> = {
  'google-ads': { 'conversion-id': 'AW-123456789', 'conversion-label': 'AbCdEfGhIj' },
  'ga4': { 'measurement-id': 'G-ABC123XYZ' },
  'meta': { 'pixel-id': '1234567890123456' },
  'tiktok': { 'pixel-id': 'C4ABCDEFGH1234567890' },
  'linkedin': { 'partner-id': '1234567', 'conversion-id': '12345678' },
  'microsoft': { 'uet-tag-id': '187000000' },
}

describe('bundled conversion tracking recipe builder', () => {
  for (const [send, ids] of Object.entries(destinations)) {
    test(`builds every detection recipe for ${send} without placeholder IDs or orphan triggers`, () => {
      for (const tool of tools) {
        const result = buildRecipe({ tool, send, ...ids })
        expect(JSON.stringify(result)).not.toMatch(/__[A-Z0-9]+(?:_[A-Z0-9]+)*__/)
        const version = result.containerVersion
        // GTM's built-in All Pages trigger is not listed in container exports.
        const triggers = new Set(['2147479553', ...version.trigger.map(trigger => trigger.triggerId)])
        expect(new Set(version.tag.map(tag => tag.tagId)).size).toBe(version.tag.length)
        for (const tag of version.tag) {
          for (const trigger of tag.firingTriggerId ?? [])
            expect(triggers.has(trigger)).toBe(true)
        }
      }
    })
  }

  test('validates platform IDs and excludes path traversal before reading a template', () => {
    expect(() => buildRecipe({ tool: '../event-map', send: 'ga4' })).toThrow('Choose a --tool')
    expect(() => buildRecipe({ tool: tools[0], send: '../../event-map' })).toThrow('Choose --send')
    expect(() => buildRecipe({ tool: tools[0], send: 'linkedin', 'partner-id': '1', 'conversion-id': '1);alert(1)' })).toThrow('--conversion-id')
    expect(() => buildRecipe({ tool: tools[0], send: 'microsoft', 'uet-tag-id': '187000000', 'event-name': 'purchase\n' })).toThrow('--event-name')
    expect(() => buildRecipe({ tool: tools[0], send: 'ga4', 'measurement-id': 'G-ABC123XYZ', 'event-name': 'a'.repeat(41) })).toThrow('--event-name')
  })
})
