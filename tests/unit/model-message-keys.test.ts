import { describe, expect, it } from 'bun:test'
import { messageKeys } from '../../storage/framework/core/validation/src/messages'

// A model attribute's `message: { ... }` is keyed by the name of a rule its
// validator has (`{ min: ... }`), `required`, or the field's own name for any
// failure. A key that is none of those is never shown, and the defaults had
// twelve: `status: { oneOf: ... }` on an enum, `unitPrice: { string: ... }` on
// a number, `lastPing: { invalid: ... }`.
describe('built-in model messages', () => {
  it('are keyed by a rule their validator has', async () => {
    const root = `${import.meta.dir}/../../storage/framework/defaults/app/Models`
    const unknown: string[] = []
    let checked = 0

    for (const file of new Bun.Glob('**/*.ts').scanSync({ cwd: root })) {
      const model = (await import(`${root}/${file}`)).default as { getDefinition?: () => { attributes?: Record<string, any> } }
      for (const [field, attribute] of Object.entries(model.getDefinition?.().attributes ?? {})) {
        const message = attribute?.validation?.message
        if (!message || typeof message !== 'object')
          continue
        const keys = messageKeys(attribute.validation.rule)
        for (const key of Object.keys(message)) {
          checked++
          if (!keys.has(key) && key !== 'required' && key !== field)
            unknown.push(`${file} ${field}.${key} (rules: ${[...keys].join(', ')})`)
        }
      }
    }

    expect(checked).toBeGreaterThan(200)
    expect(unknown).toEqual([])
  }, 60000)
})
