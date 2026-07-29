import { describe, expect, it } from 'bun:test'
import queryBuilderConfig from '../../../../../config/query-builder'
import { RAW_QUERY_SOFT_DELETE_CONFIG } from '../src/utils'

describe('raw query-builder soft-delete configuration', () => {
  it('keeps process-wide filtering disabled in every framework config path', () => {
    expect(queryBuilderConfig.softDeletes).toEqual({
      enabled: false,
      column: 'deleted_at',
      defaultFilter: true,
    })
    expect(RAW_QUERY_SOFT_DELETE_CONFIG).toEqual(queryBuilderConfig.softDeletes)
  })
})
