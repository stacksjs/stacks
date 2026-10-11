import { expect, test } from 'bun:test'
import { receiptLinesText } from '../src/receipt-text'

test('lists each purchase line with its quantity and formatted amount', () => {
  expect(receiptLinesText([
    { name: 'Day pass', quantity: 2, amountMinor: 2000 },
    { name: '  10-class   pack ', amountMinor: 15000 },
  ], 'EUR', 'en-US')).toBe('2 × Day pass: €20.00\n10-class pack: €150.00')
})

test('formats in the order currency and the reader locale', () => {
  expect(receiptLinesText([{ name: 'Kurs', amountMinor: 1999 }], 'EUR', 'de-DE')).toBe('Kurs: 19,99 €')
  expect(receiptLinesText([{ name: 'Lesson', amountMinor: 1999, quantity: 0 }], 'JPY', 'en-US')).toBe('Lesson: ¥1,999')
})
