import * as authors from './authors'
import * as postCategories from './categorizables'
import * as comments from './commentables'
import * as pages from './pages'
import * as posts from './posts'
import * as tags from './taggables'

type PostsModule = typeof posts
type PostCategoriesModule = typeof postCategories
type TagsModule = typeof tags
type CommentsModule = typeof comments
type AuthorsModule = typeof authors
type PagesModule = typeof pages

export interface CmsNamespace {
  posts: PostsModule
  postCategories: PostCategoriesModule
  tags: TagsModule
  comments: CommentsModule
  authors: AuthorsModule
  pages: PagesModule
}

export const cms: CmsNamespace = {
  posts,
  postCategories,
  tags,
  comments,
  authors,
  pages,
}

export default cms

export {
  authors,
  postCategories as categorizable,
  comments,
  pages,
  posts,
  tags,
}

// Real pages: block documents, revisions, redirects, menus, public serving.
export { defaultBlocks, registerDefaultBlocks } from './blocks/defaults'
export { allBlocks, defineBlock, getBlock, parseStoredBlocks, registerBlocks, validateBlocks } from './blocks/registry'
export type { BlockDefinition, BlockError, PageBlock, ValidateBlocksResult } from './blocks/types'
export { fetchMenuTree } from './menus'
export type { MenuTreeItem } from './menus'
export { createPageDocument, PageDocumentError, updatePageDocument } from './pages/document'
export type { SavedPageDocument, SavePageDocumentInput } from './pages/document'
export { publishDuePages } from './publish'
export { cmsNotFoundFallback, cmsPageFallback } from './public/fallback'
export { renderCmsPage } from './public/render'
export { normalizePath, resolvePublishedPage } from './public/resolve'
export type { PublishedPage } from './public/resolve'
export { sanitizeRichText } from './public/sanitize'
export { recordSlugChangeRedirects, resolveRedirect } from './redirects'
export { fetchRevisions, restoreRevision, storeRevision } from './revisions'
