import { db } from '@stacksjs/database'

/**
 * Creating a site and giving it something to serve.
 *
 * Every multi-tenant app built on `@stacksjs/sites` ends up writing the same
 * function: take a tenant, make sure it has a Site row, carry the tenant's
 * branding onto it, and seed the pages a new site starts with. CampusHQ wrote
 * it for schools; a storefront builder would write it for merchants.
 *
 * The parts that are the same every time live here. What a tenant IS, and
 * which pages it starts with, stay with the app - this takes them as
 * arguments rather than guessing.
 *
 * Idempotency is the whole point. Provisioning is a button people press twice,
 * a seeder that re-runs, a retried request: a second pass re-themes the site,
 * adds only the pages that are missing, and never touches one somebody has
 * since edited.
 */

export interface SiteProvisionPage {
  title: string
  /** '/' for the root page; anything else is slugified under its parent. */
  slug: string
  status?: 'draft' | 'published' | 'scheduled'
  blocks?: Array<{ type: string, props?: Record<string, unknown> }>
  parentId?: number
}

export interface SiteProvisionInput {
  /** Human-readable site name, e.g. "Lakeside Country Day website". */
  name: string
  /** The host label: `{subdomain}.{baseDomain}` resolves to this site. */
  subdomain: string
  timezone?: string
  /** Render-time knobs stored as JSON - theme tokens, locale, analytics id. */
  settings?: Record<string, unknown>
  /** Pages to seed. Existing paths are left alone. */
  pages?: SiteProvisionPage[]
  /**
   * A site id the caller already knows about (the tenant's `site_id`). When
   * given, that site is refreshed rather than a second one being created for
   * the same subdomain.
   */
  siteId?: number | null
}

export interface SiteProvisionResult {
  siteId: number
  subdomain: string
  /** False when an existing site was refreshed. */
  created: boolean
  /** Paths written by this call. */
  pagesCreated: string[]
  /** Paths that already existed and were left as they were. */
  pagesKept: string[]
}

/**
 * Create or refresh a site, then seed any missing pages.
 *
 * Page seeding needs `@stacksjs/cms`, which is imported lazily so an app using
 * sites WITHOUT the CMS feature does not pull it in - and a caller passing no
 * pages never touches it at all.
 */
export async function provisionSite(input: SiteProvisionInput): Promise<SiteProvisionResult> {
  const existing = input.siteId
    ? await db.selectFrom('sites').selectAll().where('id', '=', input.siteId).executeTakeFirst()
    : await db.selectFrom('sites').selectAll().where('subdomain', '=', input.subdomain).executeTakeFirst()

  const settings = JSON.stringify(input.settings ?? {})
  let siteId: number
  let created = false

  if (existing) {
    siteId = Number((existing as { id: number }).id)
    await db
      .updateTable('sites')
      .set({ settings, ...(input.timezone ? { timezone: input.timezone } : {}) })
      .where('id', '=', siteId)
      .execute()
  }
  else {
    const inserted = await db
      .insertInto('sites')
      .values({
        name: input.name,
        subdomain: input.subdomain,
        status: 'active',
        settings,
        ...(input.timezone ? { timezone: input.timezone } : {}),
      })
      .returning('id')
      .executeTakeFirst()

    siteId = Number((inserted as { id: number } | undefined)?.id)
    created = true
  }

  const pagesCreated: string[] = []
  const pagesKept: string[] = []

  if (input.pages?.length) {
    const { createPageDocument, registerDefaultBlocks } = await import('@stacksjs/cms')
    registerDefaultBlocks()

    for (const page of input.pages) {
      const path = page.slug === '/' ? '/' : `/${page.slug}`
      const already = await db
        .selectFrom('pages')
        .select('id')
        .where('site_id', '=', siteId)
        .where('path', '=', path)
        .executeTakeFirst()

      if (already) {
        pagesKept.push(path)
        continue
      }

      await createPageDocument(siteId, {
        title: page.title,
        slug: page.slug,
        status: page.status ?? 'published',
        blocks: page.blocks ?? [],
        parentId: page.parentId,
      })
      pagesCreated.push(path)
    }
  }

  return { siteId, subdomain: input.subdomain, created, pagesCreated, pagesKept }
}
