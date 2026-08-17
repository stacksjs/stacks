/**
 * `provisionSite` - creating a site and seeding what it serves.
 *
 * The property worth defending is idempotency: this runs from a button people
 * double-click, from a seeder that re-runs, and from retried requests. A
 * second pass must not produce a second site, a duplicate page tree, or
 * overwrite a page somebody has edited since.
 */

import { beforeEach, describe, expect, it } from 'bun:test'
import { db } from '@stacksjs/database'
import { provisionSite } from '../src/provision'
import { refreshDatabase } from './setup'

const SUBDOMAIN = 'provision-test'

// `refreshDatabase` also re-pins the database config, which the old
// subdomain-scoped cleanup did not: `bun test` runs the directory in one
// process, so a sibling file can otherwise win the connection between tests.
beforeEach(refreshDatabase)

const pages = [
  { title: 'Home', slug: '/', blocks: [{ type: 'rich-text', props: { html: '<p>Welcome.</p>' } }] },
  { title: 'About', slug: 'about', blocks: [{ type: 'rich-text', props: { html: '<p>About us.</p>' } }] },
]

describe('provisionSite', () => {
  it('creates a site with its settings and seeds the pages', async () => {
    const result = await provisionSite({
      name: 'Provision Test',
      subdomain: SUBDOMAIN,
      timezone: 'America/New_York',
      settings: { theme: { primaryColor: '#2b5c8a' } },
      pages,
    })

    expect(result.created).toBe(true)
    expect(result.pagesCreated).toEqual(['/', '/about'])

    const site = await db.selectFrom('sites').selectAll().where('id', '=', result.siteId).executeTakeFirst() as any
    expect(site.subdomain).toBe(SUBDOMAIN)
    const settings = typeof site.settings === 'string' ? JSON.parse(site.settings) : site.settings
    expect(settings.theme.primaryColor).toBe('#2b5c8a')
  })

  it('refreshes rather than duplicating on a second pass', async () => {
    const first = await provisionSite({ name: 'Provision Test', subdomain: SUBDOMAIN, pages })
    const second = await provisionSite({
      name: 'Provision Test',
      subdomain: SUBDOMAIN,
      settings: { theme: { primaryColor: '#111111' } },
      pages,
    })

    expect(second.created).toBe(false)
    expect(second.siteId).toBe(first.siteId)
    expect(second.pagesCreated).toEqual([])
    expect(second.pagesKept).toEqual(['/', '/about'])

    const sites = await db.selectFrom('sites').select(['id']).where('subdomain', '=', SUBDOMAIN).execute()
    expect(sites).toHaveLength(1)

    // The theme follows the tenant's current branding...
    const site = await db.selectFrom('sites').selectAll().where('id', '=', first.siteId).executeTakeFirst() as any
    const settings = typeof site.settings === 'string' ? JSON.parse(site.settings) : site.settings
    expect(settings.theme.primaryColor).toBe('#111111')
  })

  it('leaves an edited page alone', async () => {
    const first = await provisionSite({ name: 'Provision Test', subdomain: SUBDOMAIN, pages })

    const edited = 'Someone rewrote this page.'
    await db
      .updateTable('pages')
      .set({ blocks: JSON.stringify([{ type: 'rich-text', props: { html: `<p>${edited}</p>` } }]) })
      .where('site_id', '=', first.siteId)
      .where('path', '=', '/about')
      .execute()

    await provisionSite({ name: 'Provision Test', subdomain: SUBDOMAIN, pages })

    const page = await db
      .selectFrom('pages')
      .select(['blocks'])
      .where('site_id', '=', first.siteId)
      .where('path', '=', '/about')
      .executeTakeFirst() as any

    expect(String(page.blocks)).toContain(edited)
  })

  it('adds only the pages that are missing', async () => {
    const first = await provisionSite({ name: 'Provision Test', subdomain: SUBDOMAIN, pages })

    const second = await provisionSite({
      name: 'Provision Test',
      subdomain: SUBDOMAIN,
      siteId: first.siteId,
      pages: [...pages, { title: 'Contact', slug: 'contact' }],
    })

    expect(second.pagesCreated).toEqual(['/contact'])
    expect(second.pagesKept).toEqual(['/', '/about'])
  })

  it('creates a bare site when the caller seeds no pages', async () => {
    const result = await provisionSite({ name: 'Provision Test', subdomain: SUBDOMAIN })

    expect(result.created).toBe(true)
    expect(result.pagesCreated).toEqual([])

    const rows = await db.selectFrom('pages').select(['id']).where('site_id', '=', result.siteId).execute()
    expect(rows).toHaveLength(0)
  })
})
