import { describe, expect, it } from 'bun:test'
import ModelShowAction, { parseFilters } from '../../storage/framework/defaults/app/Actions/Dashboard/Models/ModelShowAction'
import { isValidModelSlug, slugToPascal } from '../../storage/framework/defaults/app/Actions/Dashboard/Models/model-write'

describe('dashboard model query input', () => {
  it('accepts only canonical model slugs at the route boundary', () => {
    expect(isValidModelSlug('user')).toBe(true)
    expect(isValidModelSlug('analytics-event')).toBe(true)
    expect(slugToPascal('analytics-event')).toBe('AnalyticsEvent')

    expect(isValidModelSlug('')).toBe(false)
    expect(isValidModelSlug('1')).toBe(false)
    expect(isValidModelSlug('User')).toBe(false)
    expect(isValidModelSlug('analytics_event')).toBe(false)
    expect(isValidModelSlug('analytics--event')).toBe(false)
  })

  it('rejects an invalid model slug before deriving a table name', async () => {
    const response = await ModelShowAction.handle({
      getParam: () => '1',
    }) as Response

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({
      message: 'Model slug must be lowercase kebab-case.',
    })
  })

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
