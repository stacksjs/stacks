import type { Router } from 'vue-router'
import { useAuth } from '../../../../defaults/functions/auth'

interface PluginContext {
  router: Router
  app: any
}

export function install(ctx: PluginContext) {   
  const { checkAuthentication } = useAuth()

  ctx.router.beforeEach(async (to, from, next) => {
    if (to.meta.requiresAuth === false) {
      next()
      return
    }

    const isAuthenticated = await checkAuthentication()

    if (to.meta.requiresAuth && !isAuthenticated) {
      next('/login')
    }
    else {
      next()
    }
  })
} 