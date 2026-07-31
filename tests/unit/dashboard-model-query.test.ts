import { describe, expect, it } from 'bun:test'
import { parseFilters } from '../../storage/framework/defaults/app/Actions/Dashboard/Models/ModelShowAction'

describe('dashboard model query input', () => {
  it('parses scalar column filters', () => {
    expect(parseFilters('{"status":"active","count":2,"enabled":true}')).toEqual({
      status: 'active',
      count: '2',
      enabled: 'true',
    })
  })

  it('reports malformed or ambiguous filters', () => {
    expect(() => parseFilters('{')).toThrow('Could not parse model filters')
    expect(() => parseFilters('[]')).toThrow('Model filters must be a JSON object')
    expect(() => parseFilters('{"status":{"value":"active"}}'))
      .toThrow('Model filter "status" must be a scalar value')
    expect(() => parseFilters('{"bad-column":"active"}'))
      .toThrow('Invalid model filter column "bad-column"')
  })
})
