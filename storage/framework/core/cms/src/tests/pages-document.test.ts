import { beforeEach, describe, expect, it } from 'bun:test'
import { registerDefaultBlocks } from '../blocks/defaults'
import { parseStoredBlocks, validateBlocks } from '../blocks/registry'
import { getDb } from '../database'
import { fetchMenuTree } from '../menus'
import { createPageDocument, PageDocumentError, updatePageDocument } from '../pages/document'
import { publishDuePages } from '../publish'
import { normalizePath, resolvePublishedPage } from '../public/resolve'
import { sanitizeRichText } from '../public/sanitize'
import { resolveRedirect } from '../redirects'
import { fetchRevisions, restoreRevision } from '../revisions'
import { refreshDatabase } from './setup'

const SITE = 1
const OTHER_SITE = 2

beforeEach(async () => {
  await refreshDatabase()
  registerDefaultBlocks()
})

describe('validateBlocks', () => {
  it('accepts a valid document and assigns ids', async () => {
    const result = await validateBlocks([
      { type: 'hero', props: { heading: 'Welcome' } },
      { type: 'rich-text', props: { html: '<p>hi</p>' } },
    ])
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.blocks).toHaveLength(2)
      expect(result.blocks[0]?.id).toBeTruthy()
    }
  })

  it('rejects unknown types, unknown props and missing required props', async () => {
    const result = await validateBlocks([
      { type: 'nope', props: {} },
      { type: 'hero', props: { heading: 'ok', bogus: 1 } },
      { type: 'cta', props: { heading: 'x' } },
    ])
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.errors.some(error => error.message.includes('unknown block type'))).toBe(true)
      expect(result.errors.some(error => error.message.includes('unknown prop'))).toBe(true)
      expect(result.errors.some(error => error.message.includes('missing required prop'))).toBe(true)
    }
  })

  it('rejects a non-array document', async () => {
    const result = await validateBlocks({ not: 'an array' })
    expect(result.ok).toBe(false)
  })
})

describe('createPageDocument', () => {
  it('creates a page with a derived slug and path', async () => {
    const saved = await createPageDocument(SITE, {
      title: 'Visit Our Campus',
      blocks: [{ type: 'hero', props: { heading: 'Come see us' } }],
      status: 'published',
    })
    expect(saved.path).toBe('/visit-our-campus')

    const resolved = await resolvePublishedPage(SITE, '/visit-our-campus')
    expect(resolved?.title).toBe('Visit Our Campus')
    expect(resolved?.blocks[0]?.type).toBe('hero')
  })

  it('deduplicates colliding paths per site but not across sites', async () => {
    const first = await createPageDocument(SITE, { title: 'About' })
    const second = await createPageDocument(SITE, { title: 'About' })
    const otherSite = await createPageDocument(OTHER_SITE, { title: 'About' })

    expect(first.path).toBe('/about')
    expect(second.path).toBe('/about-2')
    expect(otherSite.path).toBe('/about')
  })

  it('nests under a parent page', async () => {
    const parent = await createPageDocument(SITE, { title: 'Admissions' })
    const child = await createPageDocument(SITE, { title: 'Visit', parentId: parent.id })
    expect(child.path).toBe('/admissions/visit')
  })

  it('rejects invalid blocks with a 422-status error', async () => {
    try {
      await createPageDocument(SITE, { title: 'Bad', blocks: [{ type: 'nope' }] })
      expect.unreachable('should have thrown')
    }
    catch (error) {
      expect(error).toBeInstanceOf(PageDocumentError)
      expect((error as PageDocumentError).status).toBe(422)
    }
  })
})

describe('updatePageDocument', () => {
  it('snapshots the previous document as a revision', async () => {
    const page = await createPageDocument(SITE, {
      title: 'History',
      blocks: [{ type: 'rich-text', props: { html: '<p>v1</p>' } }],
    })

    await updatePageDocument(SITE, page.id, {
      title: 'Our History',
      blocks: [{ type: 'rich-text', props: { html: '<p>v2</p>' } }],
    })

    const revisions = await fetchRevisions(page.id)
    expect(revisions).toHaveLength(1)
    expect(revisions[0]?.title).toBe('History')
    expect(parseStoredBlocks(revisions[0]?.blocks)[0]?.props.html).toBe('<p>v1</p>')
  })

  it('a slug change moves descendants and leaves redirects for every old path', async () => {
    const parent = await createPageDocument(SITE, { title: 'Admissions', status: 'published' })
    const child = await createPageDocument(SITE, { title: 'Visit', parentId: parent.id, status: 'published' })
    expect(child.path).toBe('/admissions/visit')

    await updatePageDocument(SITE, parent.id, { title: 'Enrollment', slug: 'enrollment', status: 'published' })

    const movedParent = await resolvePublishedPage(SITE, '/enrollment')
    const movedChild = await resolvePublishedPage(SITE, '/enrollment/visit')
    expect(movedParent?.id).toBe(parent.id)
    expect(movedChild?.id).toBe(child.id)

    expect(await resolveRedirect(SITE, '/admissions')).toEqual({ toPath: '/enrollment', statusCode: 301 })
    expect(await resolveRedirect(SITE, '/admissions/visit')).toEqual({ toPath: '/enrollment/visit', statusCode: 301 })
  })

  it('renaming twice keeps redirects one hop', async () => {
    const page = await createPageDocument(SITE, { title: 'Programs', status: 'published' })
    await updatePageDocument(SITE, page.id, { title: 'Programs', slug: 'academics', status: 'published' })
    await updatePageDocument(SITE, page.id, { title: 'Programs', slug: 'learning', status: 'published' })

    expect(await resolveRedirect(SITE, '/programs')).toEqual({ toPath: '/learning', statusCode: 301 })
    expect(await resolveRedirect(SITE, '/academics')).toEqual({ toPath: '/learning', statusCode: 301 })
  })

  it('refuses to touch another site\'s page', async () => {
    const page = await createPageDocument(SITE, { title: 'Private' })
    await expect(updatePageDocument(OTHER_SITE, page.id, { title: 'Stolen' })).rejects.toThrow(PageDocumentError)
  })
})

describe('restoreRevision', () => {
  it('restores and is itself undoable', async () => {
    const page = await createPageDocument(SITE, {
      title: 'v1',
      blocks: [{ type: 'rich-text', props: { html: '<p>one</p>' } }],
    })
    await updatePageDocument(SITE, page.id, {
      title: 'v2',
      blocks: [{ type: 'rich-text', props: { html: '<p>two</p>' } }],
    })

    const [revision] = await fetchRevisions(page.id)
    await restoreRevision(revision!.id)

    const db = await getDb()
    const row = await db.selectFrom('pages').where('id', '=', page.id).select(['title']).executeTakeFirst() as { title: string }
    expect(row.title).toBe('v1')

    // The restore snapshotted v2 first, so nothing is lost.
    const revisions = await fetchRevisions(page.id)
    expect(revisions).toHaveLength(2)
    expect(revisions[0]?.title).toBe('v2')
  })
})

describe('resolvePublishedPage', () => {
  it('never serves drafts or scheduled pages', async () => {
    await createPageDocument(SITE, { title: 'Draft Thing' })
    await createPageDocument(SITE, { title: 'Later Thing', status: 'scheduled', scheduledAt: '2999-01-01 00:00:00' })

    expect(await resolvePublishedPage(SITE, '/draft-thing')).toBeNull()
    expect(await resolvePublishedPage(SITE, '/later-thing')).toBeNull()
  })

  it('is site-scoped', async () => {
    await createPageDocument(SITE, { title: 'Ours', status: 'published' })
    expect(await resolvePublishedPage(OTHER_SITE, '/ours')).toBeNull()
  })

  it('treats trailing slashes as the same page', async () => {
    await createPageDocument(SITE, { title: 'Contact', status: 'published' })
    expect((await resolvePublishedPage(SITE, '/contact/'))?.title).toBe('Contact')
    expect(normalizePath('/contact/')).toBe('/contact')
    expect(normalizePath('/')).toBe('/')
  })
})

describe('publishDuePages', () => {
  it('flips due scheduled pages and leaves future ones alone', async () => {
    await createPageDocument(SITE, { title: 'Due', status: 'scheduled', scheduledAt: '2020-01-01 00:00:00' })
    await createPageDocument(SITE, { title: 'Future', status: 'scheduled', scheduledAt: '2999-01-01 00:00:00' })

    const flipped = await publishDuePages()
    expect(flipped).toBe(1)

    expect((await resolvePublishedPage(SITE, '/due'))?.title).toBe('Due')
    expect(await resolvePublishedPage(SITE, '/future')).toBeNull()
  })
})

describe('fetchMenuTree', () => {
  it('resolves page links to live paths and drops unpublished ones', async () => {
    const db = await getDb()
    const published = await createPageDocument(SITE, { title: 'About', status: 'published' })
    const draft = await createPageDocument(SITE, { title: 'Hidden' })

    await db.insertInto('menus').values({ site_id: SITE, handle: 'main', name: 'Main' }).execute()
    const menu = await db.selectFrom('menus').where('handle', '=', 'main').select(['id']).executeTakeFirst() as { id: number }

    // Uniform key sets: a mixed-shape bulk insert maps later rows onto the
    // first row's column list.
    await db.insertInto('menu_items').values([
      { menu_id: menu.id, page_id: published.id, url: null, label: 'About', position: 1 },
      { menu_id: menu.id, page_id: draft.id, url: null, label: 'Hidden', position: 2 },
      { menu_id: menu.id, page_id: null, url: 'https://example.org', label: 'External', position: 3 },
    ]).execute()

    const tree = await fetchMenuTree(SITE, 'main')
    expect(tree.map(item => item.label)).toEqual(['About', 'External'])
    expect(tree[0]?.href).toBe('/about')
  })
})

describe('sanitizeRichText', () => {
  it('strips scripts, handlers and javascript URLs but keeps formatting', () => {
    const dirty = '<p onclick="evil()">Hello <b>world</b></p><script>steal()</script><a href="javascript:evil()">x</a>'
    const clean = sanitizeRichText(dirty)
    expect(clean).not.toContain('<script')
    expect(clean).not.toContain('onclick')
    expect(clean).not.toContain('javascript:')
    expect(clean).toContain('<b>world</b>')
  })
})
