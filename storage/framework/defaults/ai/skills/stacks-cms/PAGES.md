# Block documents and public CMS pages

The root `@stacksjs/cms` entry exports this surface alongside the legacy
posts/authors/tags/comments namespace. Page documents are site-scoped; resolve
the site's identity once at the route boundary and pass it explicitly.

## Authoring a document

```ts
import { createPageDocument, registerDefaultBlocks } from '@stacksjs/cms'

registerDefaultBlocks()
const page = await createPageDocument(siteId, {
  title: 'About us',
  slug: 'about',
  blocks: [],
  status: 'draft',
})
```

`SavePageDocumentInput` carries title, slug, parentId, template, blocks,
metaDescription, status, scheduledAt, authorId and note. `slug: '/'` creates
a root page. Child paths derive from the parent; path collisions are resolved
within the site. An empty document is valid, but a block type must be registered
before it is accepted. `fetchPageDocument(siteId, pageId)` returns the editable
parsed document or null.

`defineBlock` and `registerBlocks` define the type/schema/template registry.
Application registrations can replace a default type. `validateBlocks` rejects
unknown types, unknown props, missing required props and invalid values; it
returns either validated blocks or structured errors. `parseStoredBlocks` is
a defensive storage reader, not a substitute for write-time validation.

## Updates, revisions and redirects

`updatePageDocument(siteId, pageId, input)` validates blocks, snapshots the old
document as a revision, recomputes changed paths, moves descendant paths and
records redirects for old paths. Supply the complete intended document fields;
do not assume every optional field behaves like a sparse PATCH. Invalid input
raises `PageDocumentError` with status 422. A cross-site page id is refused.

`fetchRevisions`, `storeRevision` and `restoreRevision` support history. A
restore is itself undoable. `recordSlugChangeRedirects` and `resolveRedirect`
provide the redirect layer. Route ids and CMS paths are distinct identifiers.

## Publish, render and navigate

Statuses are draft, published, scheduled and archived. `publishDuePages`
publishes due scheduled rows; schedule that operation in an enabled scheduler
instead of assuming a scheduled_at value wakes a worker by itself.

`resolvePublishedPage(siteId, path)` resolves published content and normalizes
a trailing slash. Draft/scheduled rows are invisible. `renderCmsPage` renders
registered block templates, `sanitizeRichText` constrains editorial markup,
and `cmsPageFallback`/`cmsNotFoundFallback` integrate with public serving.
Existing coded views win over CMS fallback content. A page row is not a wildcard
override of every application route.

`fetchMenuTree` resolves page links to current paths and omits unpublished
page links. Menus, redirects, revisions and page models all participate in CMS
feature migration ownership. Public reads follow host-resolved sites; admin
editing follows authenticated ownership, not an ambient public site guess.

## Source and evidence

Read `storage/framework/core/cms/src/pages/document.ts`, `blocks/registry.ts`,
`public/resolve.ts`, `public/fallback.ts`, `publish/`, `menus/`, `revisions/`
and `redirects/`. Retained tests are `src/tests/pages-document.test.ts`,
`pages-crud.test.ts` and `public-serving.test.ts`, including tenant isolation,
redirect flattening, document validation and real STX serving precedence.
