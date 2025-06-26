import type { Router } from 'vue-router'
import { useAuth } from '../../../../defaults/functions/auth'

interface PluginContext {
  router: Router
}

export function install(ctx: PluginContext) {
  const { checkAuthentication } = useAuth()

  ctx.router.beforeEach(async (to, from, next) => {
    const isAuthenticated = await checkAuthentication()

    // If route explicitly doesn't require auth (guest-only pages like login/signup)
    if (to.meta.requiresAuth === false) {
      // If user is authenticated, redirect to home
      if (isAuthenticated && ['/login', '/register'].includes(to.path)) {
        next('/')
        return
      }
      // If not authenticated, allow access to guest pages
      next()
      return
    }

    // For routes that require auth
    if (to.meta.requiresAuth && !isAuthenticated) {
      next('/login')
    }
    else {
      next()
    }
  })
}
