import { describe, expect, it } from 'bun:test'
import {
  defaultDashboardToggles,
  resolveDashboardToggles,
} from '../../storage/framework/defaults/resources/functions/dashboard/toggles'

describe('dashboard toggle configuration', () => {
  it('defaults optional sections while keeping CI opt-in', () => {
    expect(resolveDashboardToggles({})).toEqual(defaultDashboardToggles())
  })

  it('deeply merges configured section and data toggles', () => {
    const toggles = resolveDashboardToggles({
      sections: {
        commerce: { enabled: false },
        data: {
          subscribers: { enabled: false },
        },
      },
      ci: { enabled: true },
    })

    expect(toggles.commerce).toBe(false)
    expect(toggles.ci).toBe(true)
    expect(toggles.data).toEqual({
      dashboard: true,
      activity: true,
      users: true,
      teams: true,
      subscribers: false,
      allModels: true,
    })
  })

  it('reports invalid toggle values instead of enabling them implicitly', () => {
    expect(() => resolveDashboardToggles({
      sections: {
        commerce: { enabled: 'false' },
      },
    })).toThrow('dashboard config commerce.enabled must be a boolean')

    expect(() => resolveDashboardToggles({
      sections: {
        data: false,
      },
    })).toThrow('dashboard config sections.data must be an object')
  })
})
