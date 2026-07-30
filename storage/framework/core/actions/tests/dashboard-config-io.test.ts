import { describe, expect, it } from 'bun:test'
import { rewriteConfigKeys } from '../../../defaults/resources/functions/dashboard/config-io'

const source = `export default {
  name: 'Stacks',
  port: 3000,
  enabled: true,
  host: env.APP_HOST ?? 'localhost',
}
`

describe('dashboard config writes', () => {
  it('rewrites every scalar only after the full batch validates', () => {
    const rewritten = rewriteConfigKeys(source, [
      { key: 'name', value: 'Dashboard' },
      { key: 'port', value: 3002 },
      { key: 'enabled', value: false },
    ])

    expect(rewritten).toContain("name: 'Dashboard'")
    expect(rewritten).toContain('port: 3002')
    expect(rewritten).toContain('enabled: false')
  })

  it('does not expose a partial rewrite when a later field is invalid', () => {
    expect(() => rewriteConfigKeys(source, [
      { key: 'name', value: 'Changed' },
      { key: 'host', value: 'example.test' },
    ])).toThrow('Cannot edit "host"')
    expect(source).toContain("name: 'Stacks'")
  })

  it('rejects duplicate keys instead of applying ambiguous updates', () => {
    expect(() => rewriteConfigKeys(source, [
      { key: 'port', value: 3001 },
      { key: 'port', value: 3002 },
    ])).toThrow('Duplicate or empty configuration key "port"')
  })
})
