import * as posts from './posts'
import * as postCategories from './categories'

type PostsModule = typeof posts
type PostCategoriesModule = typeof postCategories

export interface CmsNamespace {
  posts: PostsModule
  postCategories: PostCategoriesModule
}

export const cms: CmsNamespace = {
  posts,
  postCategories,
}

export default cms

export {
  posts,
  postCategories,
}
