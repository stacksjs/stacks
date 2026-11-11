import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * The dashboard's three form controls are one family (stacksjs/stacks#3256).
 *
 * Side by side in a form they were three: the textarea had a brighter label,
 * a darker surface and larger text, the select set no text colour and so read
 * as disabled, and each sized its hint and its error differently.
 */
function source(path: string): string {
  return readFileSync(resolve(path), 'utf8')
}

describe('input, select and textarea', () => {
  const components = 'storage/framework/defaults/resources/components/Dashboard'
  const ui = (name: string) => source(`${components}/UI/${name}.stx`)

  test('input, select and textarea share a label, a surface and a message size', () => {
    for (const name of ['Input', 'Select', 'Textarea']) {
      const text = ui(name)
      expect(text).toContain('font-medium text-[13px] tracking-tight')
      expect(text).toContain('\'text-stone-600 dark:text-neutral-400\'')
      expect(text).toContain('bg-white dark:bg-white/10')
      expect(text).toContain('text-stone-900 dark:text-neutral-100')
      expect(text).toContain('class="mt-1.5 text-[12px] text-red-600 dark:text-red-400"')
      expect(text).toContain('class="mt-1.5 text-[12px] text-stone-500 dark:text-neutral-400"')
    }
  })

  test('each tells assistive technology when its value was refused', () => {
    for (const name of ['Input', 'Select', 'Textarea'])
      expect(ui(name)).toContain(':aria-invalid="liveError() ? \'true\' : null"')
  })

  test('a textarea can be fixed-width, for JSON, without restyling its label', () => {
    // Passing a class did that: the component's wrapper carries its attributes.
    const textarea = ui('Textarea')
    expect(textarea).toContain('const liveMonospace = useReactiveProp(\'monospace\', false)')
    expect(textarea).toContain('liveMonospace() ? \'font-mono text-[12px]\' : \'text-[13px]\'')
  })
})
