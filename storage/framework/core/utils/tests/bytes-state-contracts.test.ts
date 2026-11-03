import { expect, test } from 'bun:test'
import { parseBytes } from '../src/bytes'

test('byte parsing consumes a complete decimal and a known unit', () => {
  for (const input of ['1.2.3 MB', '1..5 KB', '1 XB', '.', '1e3 KB']) expect(() => parseBytes(input)).toThrow()
  expect(parseBytes('1.5 MB')).toBe(1500000)
  expect(parseBytes('.5 KiB')).toBe(512)
  expect(parseBytes('-1 KB')).toBe(-1000)
  expect(parseBytes('1')).toBe(1)
  expect(() => parseBytes(`${'9'.repeat(305)} YB`)).toThrow()
})
