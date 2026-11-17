import { describe, expect, it } from 'bun:test'
import { dashboardProjectIdentity } from './project-switcher'

describe('the project a dashboard names in its sidebar', () => {
  it('is the directory it serves, with a switcher on the developer\'s machine', () => {
    expect(dashboardProjectIdentity('/Users/dev/Code/shop', { STACKS_DASHBOARD_PROJECTS: '1' })).toEqual({ enabled: true, name: 'shop' })
  })

  it('has no switcher where the dev dashboard server did not ask for one', () => {
    // A deployed dashboard: one project, and a release directory for a name.
    expect(dashboardProjectIdentity('/var/www/shop/releases/42', {}).enabled).toBe(false)
    expect(dashboardProjectIdentity('/var/www/shop', { STACKS_DASHBOARD_PROJECTS: '0' }).enabled).toBe(false)
  })
})
