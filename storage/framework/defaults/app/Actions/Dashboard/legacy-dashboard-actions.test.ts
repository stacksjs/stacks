import { describe, expect, test } from 'bun:test'
import BuddyChatStateAction from './Buddy/BuddyChatStateAction'
import BuddyDashboardAction from './BuddyDashboardAction'
import QueryDashboardAction from './Queries/QueryDashboardAction'
import QueryIndexAction from './Queries/QueryIndexAction'

describe('legacy dashboard action routes', () => {
  test('reuse the canonical Buddy state action', () => {
    expect(BuddyDashboardAction).toBe(BuddyChatStateAction)
  })

  test('reuse the canonical persisted query action', () => {
    expect(QueryIndexAction).toBe(QueryDashboardAction)
  })
})
