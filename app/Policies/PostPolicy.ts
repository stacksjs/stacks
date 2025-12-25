import type { UserModel } from '@stacksjs/orm'
import { BasePolicy } from '@stacksjs/auth'

/**
 * Post Policy
 *
 * This policy controls authorization for Post model actions.
 * Each method returns true to allow, false to deny, or an
 * AuthorizationResponse for custom messages.
 *
 * Usage:
 * 1. Register in app/Gates.ts:
 *    policies: { 'Post': 'PostPolicy' }
 *
 * 2. Use in your code:
 *    import { Gate } from '@stacksjs/auth'
 *    await Gate.authorize('view', user, post)
 *
 * 3. Or use the middleware:
 *    route.put('/posts/:post', 'UpdatePost').middleware('can:update,post')
 */

// Define your Post type (or import from your models)
interface Post {
  id: number
  user_id: number
  published: boolean
  title?: string
}

export default class PostPolicy extends BasePolicy<Post> {
  /**
   * Run before any other checks.
   * Return true to allow, false to deny, null to continue.
   */
  before(user: UserModel | null, ability: string): boolean | null {
    // Example: Admins can do anything with posts
    // if (user?.role === 'admin') {
    //   return true
    // }
    return null // Continue to specific checks
  }

  /**
   * Determine if the user can view any posts.
   */
  viewAny(user: UserModel | null): boolean {
    // Anyone can view the posts list
    return true
  }

  /**
   * Determine if the user can view a specific post.
   */
  view(user: UserModel | null, post: Post): boolean {
    // Published posts are visible to everyone
    if (post.published) {
      return true
    }

    // Unpublished posts only visible to the author
    return user?.id === post.user_id
  }

  /**
   * Determine if the user can create posts.
   */
  create(user: UserModel | null): boolean {
    // Must be logged in to create posts
    return user !== null
  }

  /**
   * Determine if the user can update the post.
   */
  update(user: UserModel | null, post: Post): boolean {
    // Only the author can update their post
    return user?.id === post.user_id
  }

  /**
   * Determine if the user can delete the post.
   */
  delete(user: UserModel | null, post: Post): boolean {
    // Only the author can delete their post
    return user?.id === post.user_id
  }

  /**
   * Determine if the user can restore a soft-deleted post.
   */
  restore(user: UserModel | null, post: Post): boolean {
    return user?.id === post.user_id
  }

  /**
   * Determine if the user can permanently delete the post.
   */
  forceDelete(user: UserModel | null, post: Post): boolean {
    // Only allow force delete if you're the author
    return user?.id === post.user_id
  }

  /**
   * Custom ability: Can the user publish the post?
   */
  publish(user: UserModel | null, post: Post): boolean {
    return user?.id === post.user_id
  }

  /**
   * Custom ability: Can the user feature the post?
   * Returns a detailed response.
   */
  feature(user: UserModel | null, post: Post) {
    if (!user) {
      return this.deny('You must be logged in to feature posts.')
    }

    if (!post.published) {
      return this.deny('Only published posts can be featured.')
    }

    // Only admins can feature posts (example)
    // if (user.role !== 'admin') {
    //   return this.deny('Only administrators can feature posts.')
    // }

    return this.allow()
  }
}
