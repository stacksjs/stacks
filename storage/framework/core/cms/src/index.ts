import * as authors from './authors'
import * as postCategories from './categories'
import * as comments from './comments'
import * as posts from './posts'
import * as tags from './tags'

type PostsModule = typeof posts
type PostCategoriesModule = typeof postCategories
type TagsModule = typeof tags
type CommentsModule = typeof comments
type AuthorsModule = typeof authors

export interface CmsNamespace {
  posts: PostsModule
  postCategories: PostCategoriesModule
  tags: TagsModule
  comments: CommentsModule
  authors: AuthorsModule
}

export const cms: CmsNamespace = {
  posts,
  postCategories,
  tags,
  comments,
  authors,
}

export default cms

export {
  authors,
  comments,
  postCategories,
  posts,
  tags,
}
