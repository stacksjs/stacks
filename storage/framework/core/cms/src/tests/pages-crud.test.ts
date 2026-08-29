/**
 * The legacy CRUD surface (`pages.store` / `pages.update`), which the
 * generated ORM actions call.
 *
 * It drifted badly and silently. `store` wrote `author_id`, `title`,
 * `template`, `views` and `conversions` - and nothing else - so a page created
 * through it had no `site_id`, no `path` and no `blocks`. The insert
 * succeeded, the caller got a row back, and the page did not exist as far as
 * the website was concerned. `update` was a plain column write, so changing a
 * slug left `path` pointing at the old address with no redirect behind it.
 *
 * These tests exist because nothing typechecked the actions that call this
 * (defaults/app was in a gap between the app and framework tsconfigs), so the
 * only thing that could have caught it was a test that asks the serving layer
 * whether the page it just created is actually reachable.
 */

import { beforeEach, describe, expect, it } from 'bun:test'
import { registerDefaultBlocks } from '../blocks/defaults'
import { pages } from '../index'
import { resolvePublishedPage } from '../public/resolve'
import { resolveRedirect } from '../redirects'
import { refreshDatabase } from './setup'

const SITE = 7

beforeEach(async () => {
  await refreshDatabase()
  registerDefaultBlocks()
})

describe('pages.store', () => {
  it('creates a page the serving layer can actually find', async () => {
    const created = await pages.store({
      site_id: SITE,
      title: 'Athletics',
      slug: 'athletics',
      status: 'published',
      blocks: [{ type: 'rich-text', props: { html: '<p>Go team.</p>' } }],
    })

    expect(Number((created).site_id)).toBe(SITE)
    expect((created).path).toBe('/athletics')

    const served = await resolvePublishedPage(SITE, '/athletics')
    expect(served).toBeTruthy()
    expect(served!.title).toBe('Athletics')
  })

  it('accepts blocks as the JSON string a form posts', async () => {
    const created = await pages.store({
      site_id: SITE,
      title: 'Giving',
      slug: 'giving',
      status: 'published',
      blocks: JSON.stringify([{ type: 'rich-text', props: { html: '<p>Support us.</p>' } }]),
    })

    const served = await resolvePublishedPage(SITE, '/giving')
    expect(served).toBeTruthy()
    expect(JSON.stringify(served!.blocks)).toContain('Support us')
    expect((created).path).toBe('/giving')
  })

  it('derives a free path rather than colliding with an existing page', async () => {
    await pages.store({ site_id: SITE, title: 'About', slug: 'about', status: 'published' })
    const second = await pages.store({ site_id: SITE, title: 'About', slug: 'about', status: 'published' })

    expect((second).path).toBe('/about-2')
  })
})

describe('pages.update', () => {
  it('moves the path when the slug changes, and leaves a redirect behind', async () => {
    const created = await pages.store({
      site_id: SITE,
      title: 'Athletics',
      slug: 'athletics',
      status: 'published',
    })

    await pages.update(Number(created.id), { slug: 'athletics-teams' })

    expect(await resolvePublishedPage(SITE, '/athletics-teams')).toBeTruthy()
    // The old address is what is printed in last year's newsletter.
    const redirect = await resolveRedirect(SITE, '/athletics')
    expect(redirect?.toPath).toBe('/athletics-teams')
    expect(redirect?.statusCode).toBe(301)
  })

  it('validates blocks instead of writing whatever it was handed', async () => {
    const created = await pages.store({ site_id: SITE, title: 'Contact', slug: 'contact' })

    await expect(
      pages.update(Number(created.id), { blocks: [{ type: 'no-such-block', props: {} }] }),
    ).rejects.toThrow()
  })

  it('leaves a plain title edit as a plain column write', async () => {
    const created = await pages.store({
      site_id: SITE,
      title: 'Calendar',
      slug: 'calendar',
      status: 'published',
    })

    const updated = await pages.update(Number(created.id), { title: 'School Calendar' })

    expect((updated).title).toBe('School Calendar')
    // The path is derived from the slug, so a title edit must not move it.
    expect((updated).path).toBe('/calendar')
    expect(await resolvePublishedPage(SITE, '/calendar')).toBeTruthy()
  })
})
