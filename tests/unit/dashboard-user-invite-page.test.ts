import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * Where the dashboard offers the invitation (stacksjs/stacks#3252): the Users
 * page, the generic model browser and the create page all lead to one form
 * that asks for a name and an email and says what will happen.
 */
function source(path: string): string {
  return readFileSync(resolve(path), 'utf8')
}

describe('the invitation in the dashboard', () => {
  const components = 'storage/framework/defaults/resources/components/Dashboard'

  it('the Users page offers "Invite user", not "Create user"', () => {
    // The Users page is the model's own list (stacksjs/stacks#3277): one
    // button, which says what it adds, and comes back to wherever the list is.
    const list = source(`${components}/Models/ModelRecordsDashboard.stx`)
    expect(list).toContain(':if="writeCapabilities().create && !writeCapabilities().invite"')
    expect(list).toContain(':if="writeCapabilities().invite"')
    expect(list).toContain('<span :text="\'Invite \' + oneRecord()"></span>')
    expect(list).toContain('<span :text="\'Create \' + oneRecord()"></span>')
    expect(list).toContain('navigate(userInviteHref(listHref()))')
    expect(list).toContain('const listHref = derived(() => home() || `/models/${slug()}`)')
    expect(source(`${components}/Data/DataModelRecords.stx`)).toContain(':home="\'/data/\' + pageMode()"')
  })

  it('the create page leads to it too', () => {
    const create = source(`${components}/Models/ModelRecordCreate.stx`)
    expect(create).toContain(':title="modelName() + \' records are added by invitation\'"')
  })

  it('the page asks for a name and an email, and says what will happen', () => {
    const page = source(`${components}/Data/UserInvite.stx`)
    expect(page.match(/<Input\b/g)).toHaveLength(2)
    expect(page).toContain('name="name"')
    expect(page).toContain('name="email"')
    expect(page).not.toContain('password"')
    expect(page).toContain('email this person a link to choose their own password. The link works for 7 days.')
    expect(page).toContain('Send invitation')
    expect(source('storage/framework/defaults/views/dashboard/data/users/invite.stx')).toContain('<UserInvite />')
  })
})
