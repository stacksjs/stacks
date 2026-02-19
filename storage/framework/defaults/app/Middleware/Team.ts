import { HttpError } from '@stacksjs/error-handling'
import { Middleware } from '@stacksjs/router'

/**
 * Team Middleware
 *
 * Ensures the authenticated user belongs to a team. Optionally checks
 * for a specific team role via parameterized middleware.
 *
 * Usage:
 * route.get('/team/dashboard', 'TeamDashboardAction').middleware('auth').middleware('team')
 * route.get('/team/settings', 'TeamSettingsAction').middleware('auth').middleware('team:owner')
 */
export default new Middleware({
  name: 'team',
  priority: 3,

  async handle(request) {
    const user = (request as any).user || (request as any)._user || (request as any)._authenticatedUser

    if (!user) {
      throw new HttpError(401, 'Unauthenticated.')
    }

    // Check if user belongs to any team
    if (!user.current_team_id && !user.team_id) {
      throw new HttpError(403, 'You must belong to a team to access this resource.')
    }

    // If a specific role is required (e.g., 'team:owner')
    const requiredRole = (request as any)._middlewareParams?.team
    if (requiredRole && user.team_role !== requiredRole) {
      throw new HttpError(403, `This action requires the '${requiredRole}' team role.`)
    }
  },
})
