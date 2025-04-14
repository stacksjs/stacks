import * as postCategories from './categories'
import * as comments from './comments'
import * as posts from './posts'
import * as tags from './tags'

type PostsModule = typeof posts
type PostCategoriesModule = typeof postCategories
type TagsModule = typeof tags
type CommentsModule = typeof comments

export interface CmsNamespace {
  posts: PostsModule
  postCategories: PostCategoriesModule
  tags: TagsModule
  comments: CommentsModule
}

export const cms: CmsNamespace = {
  posts,
  postCategories,
  tags,
  comments,
}

export default cms

export {
  comments,
  postCategories,
  posts,
  tags,
}
