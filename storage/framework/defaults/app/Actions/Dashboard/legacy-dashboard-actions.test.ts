import { describe, expect, test } from 'bun:test'
import BlogAnalyticsAction from './Analytics/BlogAnalyticsAction'
import BrowserAnalyticsAction from './Analytics/BrowserAnalyticsAction'
import CommerceAnalyticsAction from './Analytics/CommerceAnalyticsAction'
import CountryAnalyticsAction from './Analytics/CountryAnalyticsAction'
import DeviceAnalyticsAction from './Analytics/DeviceAnalyticsAction'
import PageAnalyticsAction from './Analytics/PageAnalyticsAction'
import ReferrerAnalyticsAction from './Analytics/ReferrerAnalyticsAction'
import SalesAnalyticsAction from './Analytics/SalesAnalyticsAction'
import WebAnalyticsAction from './Analytics/WebAnalyticsAction'
import BuddyChatStateAction from './Buddy/BuddyChatStateAction'
import BuddyDashboardAction from './BuddyDashboardAction'
import DashboardHealthAction from './DashboardHealthAction'
import QueryDashboardAction from './Queries/QueryDashboardAction'
import QueryIndexAction from './Queries/QueryIndexAction'
import ServiceHealthAction from './ServiceHealthAction'

describe('legacy dashboard action routes', () => {
  test('reuse the canonical Buddy state action', () => {
    expect(BuddyDashboardAction).toBe(BuddyChatStateAction)
  })

  test('reuse the canonical persisted query action', () => {
    expect(QueryIndexAction).toBe(QueryDashboardAction)
  })

  test('reuses native health probes for the legacy services route', () => {
    expect(ServiceHealthAction).toBe(DashboardHealthAction)
  })

  test('reuses canonical analytics actions for legacy routes', () => {
    for (const action of [
      BlogAnalyticsAction,
      BrowserAnalyticsAction,
      CountryAnalyticsAction,
      DeviceAnalyticsAction,
      PageAnalyticsAction,
      ReferrerAnalyticsAction,
    ])
      expect(action).toBe(WebAnalyticsAction)

    expect(CommerceAnalyticsAction).toBe(SalesAnalyticsAction)
  })
})
