import { format } from '../../src/format'
import { parse } from '../../src/parse'
import { DateTime } from '../../src/now'

console.log(JSON.stringify([
  format('2024-06-15', 'YYYY-MM-DD'),
  format(parse('2024-06-15'), 'YYYY-MM-DD'),
  DateTime.parse('2024-06-15').toDateString(),
]))
