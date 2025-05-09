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
