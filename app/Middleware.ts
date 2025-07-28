export interface Middleware {
  [key: string]: string
}

/**
 * The application's middleware aliases.
 *
 * Aliases may be used instead of class names to conveniently assign middleware to routes and groups.
 */
export default {
  'auth': 'Auth',
  'guest': 'Guest',
  'api': 'Api',
  'team': 'Team',
  'logger': 'Logger',
  'env': 'Env',
  'env:local': 'EnvLocal',
  'env:development': 'EnvDevelopment',
  'env:dev': 'EnvDevelopment',
  'env:staging': 'EnvStaging',
  'env:production': 'EnvProduction',
  'env:prod': 'EnvProduction',
  // Add more middleware aliases here
  // Note: Use ! prefix for negation (e.g., '!auth', '!env:development')
} satisfies Middleware
