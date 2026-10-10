import { expect, test } from 'bun:test'
import { csvCell, toCsv } from '../src/csv'

test('CSV preserves quotes, carriage returns, Unicode, null and numeric zero', () => {
  expect(toCsv(['name', 'value'], [['Żółć,"x"\rnext', 0], [null, -12]], { bom: true }))
    .toBe('\uFEFFname,value\r\n"Żółć,""x""\rnext",0\r\n,-12')
})
test('text formulas are escaped by default and can explicitly be exported raw', () => {
  for (const text of ['=SUM(1)', '+1', '-2', '@command', '\t=1', '  =1']) expect(csvCell(text)).toBe(`'${text}`)
  expect(csvCell('=1', { spreadsheetSafe: false })).toBe('=1')
  expect(csvCell(-2)).toBe('-2')
})
