import * as posts from './posts'

type PostsModule = typeof posts

export interface CmsNamespace {
  posts: PostsModule
}

export const cms: CmsNamespace = {
  posts,
}

export default cms

export {
  posts,
}
