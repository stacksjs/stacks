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

describe('a section whose feature is off defaults to hidden', () => {
  /**
   * The dashboard used to show a Commerce section regardless of
   * `config/commerce.ts`, and every page under it 503'd - the models those
   * pages query are never loaded when the feature is off, so the first call
   * came back `Manufacturer.orderByDesc is not a function`. Switching commerce
   * off took two edits in two files, and missing the second left a section
   * that could not load. See stacksjs/stacks#2928.
   */
  const allOff = () => false
  const allOn = () => true

  it('hides commerce, content and marketing when their features are off', () => {
    const toggles = resolveDashboardToggles({}, allOff)

    expect(toggles.commerce).toBe(false)
    expect(toggles.content).toBe(false)
    expect(toggles.marketing).toBe(false)
  })

  it('leaves the sections with no feature of their own alone', () => {
    const toggles = resolveDashboardToggles({}, allOff)

    // These have no installable feature, so there is nothing to gate them on.
    expect(toggles.library).toBe(true)
    expect(toggles.analytics).toBe(true)
    expect(toggles.management).toBe(true)
    expect(toggles.utilities).toBe(true)
  })

  it('shows them when their features are on', () => {
    const toggles = resolveDashboardToggles({}, allOn)

    expect(toggles.commerce).toBe(true)
    expect(toggles.content).toBe(true)
    expect(toggles.marketing).toBe(true)
  })

  it('maps content to the cms feature, not to a feature named content', () => {
    const asked: string[] = []
    resolveDashboardToggles({}, (name) => {
      asked.push(name)
      return true
    })

    expect(asked).toContain('cms')
    expect(asked).not.toContain('content')
    expect(asked).toContain('commerce')
    expect(asked).toContain('marketing')
  })

  it('an explicit flag in config/dashboard.ts still wins, both ways', () => {
    // An app may want a section whose feature is off, or may want to hide one
    // whose feature is on. The gate is a default, not an override.
    expect(resolveDashboardToggles({ sections: { commerce: { enabled: true } } }, allOff).commerce).toBe(true)
    expect(resolveDashboardToggles({ sections: { commerce: { enabled: false } } }, allOn).commerce).toBe(false)
  })

  it('keeps every section on when no resolver is supplied', () => {
    // The resolver is optional, so any caller that does not pass one behaves
    // exactly as it did before.
    const toggles = resolveDashboardToggles({})

    expect(toggles.commerce).toBe(true)
    expect(toggles.content).toBe(true)
    expect(toggles.marketing).toBe(true)
    expect(toggles).toEqual(defaultDashboardToggles())
  })
})
