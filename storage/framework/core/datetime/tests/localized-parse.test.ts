import { expect, test } from 'bun:test'
import { format } from '../src/format'
import { parse } from '../src/parse'

for (const locale of ['de', 'fr', 'es', 'ja', 'ru']) {
  test(`localized month names roundtrip in ${locale}`, () => {
    for (const month of [0, 2, 7, 11]) {
      const date = new Date(2024, month, 15, 12)
      for (const token of ['MMMM', 'MMM']) {
        const pattern = `D ${token} YYYY`
        const text = format(date, pattern, locale)
        const parsed = parse(text, pattern, locale)
        expect(parsed.getFullYear()).toBe(2024)
        expect(parsed.getMonth()).toBe(month)
        expect(parsed.getDate()).toBe(15)
      }
    }
  })
}
