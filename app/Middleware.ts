
export interface Middleware {
  [key: string]: string
}

/**
 * The application's middleware aliases.
 *
 * Aliases may be used instead of class names to conveniently assign middleware to routes and groups.
 */
export default {
  auth: 'Auth',
  guest: 'Guest',
  api: 'Api',
  team: 'Team',
  logger: 'Logger',
  // Add more middleware aliases here
} satisfies Middleware
